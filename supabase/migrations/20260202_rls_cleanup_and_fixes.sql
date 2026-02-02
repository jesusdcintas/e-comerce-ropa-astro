-- ============================================================
-- RLS CLEANUP & FIXES
-- Fecha: 2026-02-02
-- Descripción: Script para eliminar duplicados y corregir problemas críticos
-- ============================================================

-- PASO 1: Eliminar políticas duplicadas
-- ============================================================

DROP POLICY IF EXISTS "Admins control total notificados" ON public.cupon_notificados;
DROP POLICY IF EXISTS "Admins control total cupones" ON public.cupones;
DROP POLICY IF EXISTS "Users_View_Own_Uses" ON public.cupon_usos;

COMMENT ON TABLE public.cupon_notificados IS 'Cleaned: removed duplicate policy "Admins control total notificados"';
COMMENT ON TABLE public.cupones IS 'Cleaned: removed duplicate policy "Admins control total cupones"';
COMMENT ON TABLE public.cupon_usos IS 'Cleaned: removed duplicate policy "Users_View_Own_Uses"';


-- PASO 2: Cart Reservations - Nota sobre sesiones anónimas
-- ============================================================
-- cart_reservations usa session_id (carritos anónimos/temporales)
-- No se aplica RLS por user_id aquí. El control de acceso se maneja en la app.
-- La política "Cart_Select_Authenticated" es aceptable para este use case.
-- No hay cambios requeridos en esta tabla por ahora.


-- PASO 3: CRÍTICO - Favorites: permitir a admins DELETE/UPDATE
-- ============================================================

DROP POLICY IF EXISTS "Favorites_User_All" ON public.favorites;

CREATE POLICY "Favorites_User_All_With_Admin" ON public.favorites
FOR ALL
TO authenticated
USING (
  (auth.uid() = user_id) 
  OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
)
WITH CHECK (
  (auth.uid() = user_id) 
  OR (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text)
);

COMMENT ON POLICY "Favorites_User_All_With_Admin" ON public.favorites IS 'Users manage own favorites; admins have full access';


-- PASO 4: Añadir UPDATE policies para order_items
-- ============================================================

DROP POLICY IF EXISTS "Items_Update_Own" ON public.order_items;
CREATE POLICY "Items_Update_Own" ON public.order_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders 
    WHERE orders.id = order_items.order_id 
    AND orders.user_id = auth.uid()
  )
);

COMMENT ON POLICY "Items_Update_Own" ON public.order_items IS 'Users can update their own order items (e.g., return_requested_quantity)';


-- PASO 5: Añadir UPDATE policy para orders
-- ============================================================

DROP POLICY IF EXISTS "Orders_Update_Own" ON public.orders;
CREATE POLICY "Orders_Update_Own" ON public.orders
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

COMMENT ON POLICY "Orders_Update_Own" ON public.orders IS 'Users can update their own orders (non-critical fields)';


-- PASO 6: DELETE policy para order_items (para devoluciones)
-- ============================================================

DROP POLICY IF EXISTS "Items_Delete_Admin_Only" ON public.order_items;
CREATE POLICY "Items_Delete_Admin_Only" ON public.order_items
FOR DELETE
TO authenticated
USING (
  ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) = 'admin'::text
);

COMMENT ON POLICY "Items_Delete_Admin_Only" ON public.order_items IS 'Only admins can delete order items';


-- PASO 7: Verificar resultado
-- ============================================================

-- Ejecutar esto para ver el estado final:
-- SELECT COUNT(*) as total_policies FROM pg_policy WHERE polrelid IN (
--   SELECT oid FROM pg_class WHERE relname IN (
--     'cart_reservations', 'cupon_notificados', 'cupones', 'cupon_usos', 'favorites', 'order_items', 'orders'
--   )
-- );
