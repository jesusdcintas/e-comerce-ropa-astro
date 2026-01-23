-- ==========================================
-- 01. CAMBIOS DE ESQUEMA (Saneamiento)
-- ==========================================

-- 1. Actualización de Reglas de Cupones (Constraints de tipo)
ALTER TABLE public.reglas_cupones 
  DROP CONSTRAINT IF EXISTS reglas_cupones_tipo_regla_check;

ALTER TABLE public.reglas_cupones 
  ADD CONSTRAINT reglas_cupones_tipo_regla_check 
  CHECK (tipo_regla = ANY (ARRAY[
    'gasto_total',      -- Basado en histórico total de gasto
    'gasto_periodo',    -- Basado en histórico reciente (N días)
    'compra_minima',    -- Basado en el carrito actual (subtotal)
    'numero_compras',   -- Basado en cantidad de pedidos pagados
    'primera_compra',   -- Solo si no tiene ningún pedido 'paid' previo
    'antiguedad',       -- Basado en fecha de registro (<= N días)
    'publico'           -- Sin reglas especiales, libre uso mientras esté activo
  ]));

-- Permitir que las reglas no tengan descuento ni validez (ahora van en el cupón)
ALTER TABLE public.reglas_cupones 
  ALTER COLUMN descuento_porcentaje DROP NOT NULL,
  ALTER COLUMN dias_validez DROP NOT NULL;

-- 2. Mejora en Tabla Cupones para soporte manual/público
ALTER TABLE public.cupones 
  ADD COLUMN IF NOT EXISTS es_publico BOOLEAN DEFAULT false;

-- Indice para búsquedas rápidas por código ignorando mayúsculas/minúsculas
CREATE UNIQUE INDEX IF NOT EXISTS idx_cupones_codigo_upper ON public.cupones (UPPER(codigo));

-- 3. Garantizar Integridad en la tabla de Usos
-- Evita que el mismo pedido registre el mismo cupón dos veces (crítico para webhooks)
ALTER TABLE public.cupon_usos 
  DROP CONSTRAINT IF EXISTS cupon_usos_order_id_unique,
  DROP CONSTRAINT IF EXISTS cupon_usos_unique_pedido,
  ADD CONSTRAINT cupon_usos_unique_pedido UNIQUE (cupon_id, order_id);

-- 4. Índices de rendimiento para consultas frecuentes del sistema de cupones
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON public.orders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_cupones_regla ON public.cupones (regla_id);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at);
