-- Políticas de seguridad RLS para el nuevo sistema de cupones (Idempotente)

-- 1. Tabla CUPONES
ALTER TABLE public.cupones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins control total cupones" ON public.cupones;
CREATE POLICY "Admins control total cupones" 
ON public.cupones FOR ALL 
TO authenticated 
USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Usuarios ven sus cupones o publicos" ON public.cupones;
CREATE POLICY "Usuarios ven sus cupones o publicos" 
ON public.cupones FOR SELECT 
TO authenticated 
USING (
    cliente_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM public.cupon_asignaciones 
        WHERE cupon_id = public.cupones.id AND cliente_id = auth.uid()
    ) OR
    (
        cliente_id IS NULL AND 
        EXISTS (
            SELECT 1 FROM public.reglas_cupones r 
            WHERE r.id = public.cupones.regla_id AND r.tipo_regla = 'publico'
        )
    )
);


-- 2. Tabla PUBLIC.REGLAS_CUPONES
ALTER TABLE public.reglas_cupones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins control total reglas" ON public.reglas_cupones;
CREATE POLICY "Admins control total reglas" 
ON public.reglas_cupones FOR ALL 
TO authenticated 
USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Usuarios ven reglas activas" ON public.reglas_cupones;
CREATE POLICY "Usuarios ven reglas activas" 
ON public.reglas_cupones FOR SELECT 
TO authenticated 
USING (activa = true);


-- 3. Tabla CUPON_USOS
ALTER TABLE public.cupon_usos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins control total usos" ON public.cupon_usos;
CREATE POLICY "Admins control total usos" 
ON public.cupon_usos FOR ALL 
TO authenticated 
USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Usuarios ven sus usos" ON public.cupon_usos;
CREATE POLICY "Usuarios ven sus usos" 
ON public.cupon_usos FOR SELECT 
TO authenticated 
USING (cliente_id = auth.uid());


-- 4. Tabla CUPON_NOTIFICADOS
ALTER TABLE public.cupon_notificados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins control total notificados" ON public.cupon_notificados;
CREATE POLICY "Admins control total notificados" 
ON public.cupon_notificados FOR ALL 
TO authenticated 
USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Usuarios ven sus notificaciones cupon" ON public.cupon_notificados;
CREATE POLICY "Usuarios ven sus notificaciones cupon" 
ON public.cupon_notificados FOR SELECT 
TO authenticated 
USING (cliente_id = auth.uid());


-- 6. Tabla CUPON_ASIGNACIONES (Para modo "Clientes Específicos")
CREATE TABLE IF NOT EXISTS public.cupon_asignaciones (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    cupon_id uuid REFERENCES public.cupones(id) ON DELETE CASCADE,
    cliente_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    fecha_asignacion timestamptz DEFAULT now(),
    UNIQUE(cupon_id, cliente_id)
);

ALTER TABLE public.cupon_asignaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins control total asignaciones" ON public.cupon_asignaciones;
CREATE POLICY "Admins control total asignaciones" 
ON public.cupon_asignaciones FOR ALL 
TO authenticated 
USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS "Usuarios ven sus asignaciones" ON public.cupon_asignaciones;
CREATE POLICY "Usuarios ven sus asignaciones" 
ON public.cupon_asignaciones FOR SELECT 
TO authenticated 
USING (cliente_id = auth.uid());
