-- ==========================================
-- 03. POLÍTICAS RLS (Seguridad)
-- ==========================================

-- Limpieza de políticas previas relacionadas con cupones para evitar solapamientos
DROP POLICY IF EXISTS "Admins control total cupones" ON public.cupones;
DROP POLICY IF EXISTS "Usuarios ven sus cupones o publicos" ON public.cupones;
DROP POLICY IF EXISTS "Cupones_Select_Own" ON public.cupones;
DROP POLICY IF EXISTS "Cupones_Admin" ON public.cupones;

DROP POLICY IF EXISTS "Admins control total reglas" ON public.reglas_cupones;
DROP POLICY IF EXISTS "Usuarios ven reglas activas" ON public.reglas_cupones;
DROP POLICY IF EXISTS "Reglas_Admin" ON public.reglas_cupones;
DROP POLICY IF EXISTS "Reglas_Select_Active" ON public.reglas_cupones;

DROP POLICY IF EXISTS "Admins control total usos" ON public.cupon_usos;
DROP POLICY IF EXISTS "Usuarios ven sus usos" ON public.cupon_usos;
DROP POLICY IF EXISTS "Usos_Admin" ON public.cupon_usos;
DROP POLICY IF EXISTS "Usos_Select_Own" ON public.cupon_usos;

DROP POLICY IF EXISTS "Admins control total asignaciones" ON public.cupon_asignaciones;
DROP POLICY IF EXISTS "Usuarios ven sus asignaciones" ON public.cupon_asignaciones;

-- 1. TABLA: public.cupones
ALTER TABLE public.cupones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin_Full_Access" ON public.cupones FOR ALL
  TO authenticated
  USING ( (auth.jwt() -> 'app_metadata'::text) ->> 'role'::text = 'admin' );

CREATE POLICY "User_Select_Eligible" ON public.cupones FOR SELECT
  TO authenticated
  USING (
    es_publico = true OR 
    cliente_id = auth.uid() OR 
    EXISTS (
      SELECT 1 FROM public.cupon_asignaciones 
      WHERE cupon_id = public.cupones.id AND cliente_id = auth.uid()
    )
  );

-- 2. TABLA: public.reglas_cupones
ALTER TABLE public.reglas_cupones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin_Full_Access" ON public.reglas_cupones FOR ALL
  TO authenticated
  USING ( (auth.jwt() -> 'app_metadata'::text) ->> 'role'::text = 'admin' );

CREATE POLICY "User_Select_Active" ON public.reglas_cupones FOR SELECT
  TO authenticated
  USING ( activa = true );

-- 3. TABLA: public.cupon_usos
ALTER TABLE public.cupon_usos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin_Full_Access" ON public.cupon_usos FOR ALL
  TO authenticated
  USING ( (auth.jwt() -> 'app_metadata'::text) ->> 'role'::text = 'admin' );

CREATE POLICY "User_Select_Own" ON public.cupon_usos FOR SELECT
  TO authenticated
  USING ( cliente_id = auth.uid() );

-- 4. TABLA: public.cupon_asignaciones
ALTER TABLE public.cupon_asignaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin_Full_Access" ON public.cupon_asignaciones FOR ALL
  TO authenticated
  USING ( (auth.jwt() -> 'app_metadata'::text) ->> 'role'::text = 'admin' );

CREATE POLICY "User_Select_Own" ON public.cupon_asignaciones FOR SELECT
  TO authenticated
  USING ( cliente_id = auth.uid() );

-- 5. TABLA: public.cupon_notificados
ALTER TABLE public.cupon_notificados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin_Full_Access" ON public.cupon_notificados FOR ALL
  TO authenticated
  USING ( (auth.jwt() -> 'app_metadata'::text) ->> 'role'::text = 'admin' );

CREATE POLICY "User_Select_Own" ON public.cupon_notificados FOR SELECT
  TO authenticated
  USING ( cliente_id = auth.uid() );
