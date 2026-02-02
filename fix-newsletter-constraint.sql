-- Fix: Update CHECK constraint on reglas_cupones to include 'newsletter'
-- Drop the old constraint
ALTER TABLE reglas_cupones
DROP CONSTRAINT IF EXISTS reglas_cupones_tipo_regla_check;

-- Add the new constraint with 'newsletter' included
ALTER TABLE reglas_cupones
ADD CONSTRAINT reglas_cupones_tipo_regla_check
CHECK (tipo_regla IN ('compra_minima', 'gasto_periodo', 'gasto_total', 'primera_compra', 'antiguedad', 'newsletter', 'publico'));
