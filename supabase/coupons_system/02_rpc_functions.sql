-- ==========================================
-- 02. FUNCIONES RPC (Lógica de Servidor)
-- ==========================================

-- FUNCIÓN: rpc_validate_coupon
-- Propósito: Validar todas las reglas de un cupón sin exponer la lógica al frontend.
CREATE OR REPLACE FUNCTION public.rpc_validate_coupon(
    p_code TEXT, 
    p_cart_subtotal INT, 
    p_user_id UUID
)
RETURNS TABLE (
    is_valid BOOLEAN,
    reason TEXT,
    coupon_id UUID,
    discount_percent INT
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Crucial: permite leer tablas protegidas por RLS para la validación
SET search_path = public
AS $$
DECLARE
    v_coupon RECORD;
    v_regla RECORD;
    v_order_count INT;
    v_user_created_at TIMESTAMPTZ;
BEGIN
    -- 1. Buscar cupón activo y no expirado
    SELECT c.* INTO v_coupon 
    FROM public.cupones c 
    WHERE UPPER(c.codigo) = UPPER(TRIM(p_code)) 
      AND c.activo = true 
      AND c.fecha_expiracion > NOW();

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'El código no es válido o ha expirado.'::TEXT, NULL::UUID, 0;
        RETURN;
    END IF;

    -- 2. Verificar disponibilidad (Si no es público y ya se usó)
    IF v_coupon.usado AND NOT v_coupon.es_publico THEN
        RETURN QUERY SELECT false, 'Este cupón ya ha sido utilizado.'::TEXT, NULL::UUID, 0;
        RETURN;
    END IF;

    -- 3. Verificar si el usuario ya lo usó (Límite 1 uso por cliente)
    IF EXISTS (SELECT 1 FROM public.cupon_usos WHERE cupon_id = v_coupon.id AND cliente_id = p_user_id) THEN
        RETURN QUERY SELECT false, 'Ya has canjeado este cupón en un pedido anterior.'::TEXT, NULL::UUID, 0;
        RETURN;
    END IF;

    -- 4. Verificar Segmentación/Pertenencia
    IF NOT v_coupon.es_publico THEN
        -- Si tiene cliente_id asignado, debe coincidir
        IF v_coupon.cliente_id IS NOT NULL AND v_coupon.cliente_id != p_user_id THEN
            RETURN QUERY SELECT false, 'Este cupón es exclusivo para otro usuario.'::TEXT, NULL::UUID, 0;
            RETURN;
        END IF;

        -- Si no tiene cliente_id, chequear tabla de asignaciones múltiples
        IF v_coupon.cliente_id IS NULL AND NOT EXISTS (
            SELECT 1 FROM public.cupon_asignaciones 
            WHERE cupon_id = v_coupon.id AND cliente_id = p_user_id
        ) THEN
            RETURN QUERY SELECT false, 'No tienes este cupón asignado a tu cuenta.'::TEXT, NULL::UUID, 0;
            RETURN;
        END IF;
    END IF;

    -- 5. Validación de Reglas Lógicas (reglas_cupones)
    IF v_coupon.regla_id IS NOT NULL THEN
        SELECT * INTO v_regla FROM public.reglas_cupones WHERE id = v_coupon.regla_id;
        
        -- Regla: Compra Mínima
        IF v_regla.monto_minimo > 0 AND p_cart_subtotal < v_regla.monto_minimo THEN
            RETURN QUERY SELECT false, ('Requiere una compra mínima de ' || (v_regla.monto_minimo/100)::TEXT || '€.')::TEXT, NULL::UUID, 0;
            RETURN;
        END IF;

        -- Regla: Primera Compra
        IF v_regla.tipo_regla = 'primera_compra' THEN
            SELECT COUNT(*) INTO v_order_count FROM public.orders WHERE user_id = p_user_id AND status = 'paid';
            IF v_order_count > 0 THEN
                RETURN QUERY SELECT false, 'Válido solo para clientes sin pedidos previos.'::TEXT, NULL::UUID, 0;
                RETURN;
            END IF;
        END IF;

        -- Regla: Antigüedad
        IF v_regla.tipo_regla = 'antiguedad' THEN
            SELECT created_at INTO v_user_created_at FROM public.profiles WHERE id = p_user_id;
            IF v_user_created_at < (NOW() - (v_regla.periodo_dias || ' days')::INTERVAL) THEN
                RETURN QUERY SELECT false, 'Este cupón solo es para cuentas creadas recientemente.'::TEXT, NULL::UUID, 0;
                RETURN;
            END IF;
        END IF;

        -- Regla: Gasto Período
        IF v_regla.tipo_regla = 'gasto_periodo' THEN
            SELECT COALESCE(SUM(total_amount), 0) INTO v_order_count 
            FROM public.orders 
            WHERE user_id = p_user_id 
              AND status = 'paid' 
              AND created_at > (NOW() - (v_regla.periodo_dias || ' days')::INTERVAL);
            
            IF v_order_count < v_regla.monto_minimo THEN
                RETURN QUERY SELECT false, ('Esta regla requiere un gasto de ' || (v_regla.monto_minimo/100)::TEXT || '€ en los últimos ' || v_regla.periodo_dias || ' días.')::TEXT, NULL::UUID, 0;
                RETURN;
            END IF;
        END IF;

        -- Regla: Gasto Total (Histórico)
        IF v_regla.tipo_regla = 'gasto_total' THEN
            SELECT COALESCE(SUM(total_amount), 0) INTO v_order_count 
            FROM public.orders 
            WHERE user_id = p_user_id AND status = 'paid';
            
            IF v_order_count < v_regla.monto_minimo THEN
                RETURN QUERY SELECT false, ('Esta regla requiere un gasto histórico total de ' || (v_regla.monto_minimo/100)::TEXT || '€.')::TEXT, NULL::UUID, 0;
                RETURN;
            END IF;
        END IF;

        -- Regla: Número de Compras
        IF v_regla.tipo_regla = 'numero_compras' THEN
            SELECT COUNT(*) INTO v_order_count FROM public.orders WHERE user_id = p_user_id AND status = 'paid';
            IF v_order_count < v_regla.numero_minimo THEN
                RETURN QUERY SELECT false, ('Necesitas al menos ' || v_regla.numero_minimo || ' pedidos pagados para usar este código.')::TEXT, NULL::UUID, 0;
                RETURN;
            END IF;
        END IF;
    END IF;

    -- Resultado final exitoso
    RETURN QUERY SELECT true, 'Cupón aplicado con éxito.'::TEXT, v_coupon.id, v_coupon.descuento_porcentaje;
END;
$$;


-- FUNCIÓN: rpc_consume_coupon
-- Propósito: Registrar el uso del cupón de marea atómica y segura.
CREATE OR REPLACE FUNCTION public.rpc_consume_coupon(
    p_coupon_id UUID,
    p_order_id BIGINT,
    p_user_id UUID,
    p_amount_saved INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_percent INT;
BEGIN
    -- Obtener datos del cupón para el histórico
    SELECT descuento_porcentaje INTO v_percent FROM public.cupones WHERE id = p_coupon_id;

    -- 1. Insertar el uso (La constraint UNIQUE impedirá dobles registros si se llama por error dos veces)
    INSERT INTO public.cupon_usos (cupon_id, cliente_id, order_id, discount_applied, amount_saved)
    VALUES (p_coupon_id, p_user_id, p_order_id, v_percent, p_amount_saved);

    -- 2. Marcar el cupón como usado (Solo si es de un único uso, i.e., NO público)
    UPDATE public.cupones 
    SET usado = true, 
        pedido_usado_en = p_order_id 
    WHERE id = p_coupon_id AND es_publico = false;

    RETURN true;
EXCEPTION WHEN OTHERS THEN
    -- En caso de error (ej: violación de constraint UNIQUE), devolvemos false
    RETURN false;
END;
$$;
