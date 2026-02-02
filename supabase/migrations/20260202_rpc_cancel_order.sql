-- ============================================================
-- RPC: rpc_cancel_order
-- Cancela un pedido de forma ATÓMICA (transacción única):
--   1. Valida que el pedido exista y no esté ya cancelado
--   2. Restaura stock en product_variants y products
--   3. Actualiza el estado del pedido a 'cancelled'
-- Retorna JSON con: success, was_already_cancelled, items_restored
--
-- USO: SELECT rpc_cancel_order(123, 'ONL-R-0001234');
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_cancel_order(
    p_order_id BIGINT,
    p_refund_invoice_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_items_restored INT := 0;
    v_current_variant_stock INT;
    v_current_product_stock INT;
BEGIN
    -- 1. Obtener pedido con bloqueo FOR UPDATE para evitar race conditions
    SELECT id, status, payment_status, user_id
    INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'ORDER_NOT_FOUND',
            'message', 'El pedido no existe'
        );
    END IF;

    -- 2. Si ya está cancelado, retornar sin cambios
    IF v_order.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', true,
            'was_already_cancelled', true,
            'items_restored', 0,
            'message', 'El pedido ya estaba cancelado'
        );
    END IF;

    -- 3. Restaurar stock para cada item del pedido
    FOR v_item IN
        SELECT oi.product_id, oi.product_size, oi.quantity
        FROM order_items oi
        WHERE oi.order_id = p_order_id
    LOOP
        -- 3a. Restaurar stock en variante
        SELECT stock INTO v_current_variant_stock
        FROM product_variants
        WHERE product_id = v_item.product_id
          AND size = v_item.product_size
        FOR UPDATE;

        IF FOUND THEN
            UPDATE product_variants
            SET stock = v_current_variant_stock + v_item.quantity
            WHERE product_id = v_item.product_id
              AND size = v_item.product_size;
        END IF;

        -- 3b. Restaurar stock total en producto
        SELECT stock INTO v_current_product_stock
        FROM products
        WHERE id = v_item.product_id
        FOR UPDATE;

        IF FOUND THEN
            UPDATE products
            SET stock = v_current_product_stock + v_item.quantity
            WHERE id = v_item.product_id;
        END IF;

        v_items_restored := v_items_restored + 1;
    END LOOP;

    -- 4. Actualizar estado del pedido
    UPDATE orders
    SET status = 'cancelled',
        refund_invoice_number = COALESCE(p_refund_invoice_number, refund_invoice_number),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 5. Retornar resultado exitoso
    RETURN jsonb_build_object(
        'success', true,
        'was_already_cancelled', false,
        'items_restored', v_items_restored,
        'message', 'Pedido cancelado y stock restaurado correctamente'
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Rollback implícito, retornar error
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLSTATE,
            'message', SQLERRM
        );
END;
$$;

-- Permitir ejecución solo a usuarios autenticados (el SECURITY DEFINER usa permisos del owner)
REVOKE ALL ON FUNCTION public.rpc_cancel_order(BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_cancel_order(BIGINT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.rpc_cancel_order IS 
'Cancela un pedido de forma atómica: restaura stock y actualiza estado. 
Solo debe invocarse desde el servidor con privilegios de admin.';
