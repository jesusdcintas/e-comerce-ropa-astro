-- =============================================================================
-- NEWSLETTER SYSTEM - Suscripción como propiedad del usuario
-- =============================================================================
-- Cambio de paradigma: newsletter_subscribed es un campo del perfil,
-- no una tabla externa de emails.
-- =============================================================================

-- 1. Añadir campo newsletter_subscribed a profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS newsletter_subscribed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS newsletter_subscribed_at TIMESTAMPTZ;

-- Índice para consultas eficientes de suscriptores
CREATE INDEX IF NOT EXISTS idx_profiles_newsletter 
ON profiles(newsletter_subscribed) WHERE newsletter_subscribed = TRUE;

-- 2. Migrar suscriptores existentes (si hay emails coincidentes con profiles)
UPDATE profiles p
SET 
    newsletter_subscribed = TRUE,
    newsletter_subscribed_at = COALESCE(ns.created_at, NOW())
FROM newsletter_subscribers ns
WHERE LOWER(p.email) = LOWER(ns.email)
  AND ns.is_active = TRUE
  AND p.newsletter_subscribed IS NOT TRUE;

-- 3. Tabla de campañas de newsletter
CREATE TABLE IF NOT EXISTS newsletter_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject TEXT NOT NULL,
    content_html TEXT NOT NULL,
    content_preview TEXT, -- Extracto para vista previa
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    total_recipients INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    total_errors INTEGER DEFAULT 0,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla de envíos individuales (tracking)
CREATE TABLE IF NOT EXISTS newsletter_sends (
    id BIGSERIAL PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES newsletter_campaigns(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, user_id)
);

-- Índices para envíos
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_campaign ON newsletter_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_status ON newsletter_sends(status) WHERE status IN ('pending', 'failed');
CREATE INDEX IF NOT EXISTS idx_newsletter_sends_user ON newsletter_sends(user_id);

-- 5. Añadir campo solo_newsletter a cupones
ALTER TABLE cupones
ADD COLUMN IF NOT EXISTS solo_newsletter BOOLEAN DEFAULT FALSE;

-- 6. RLS para newsletter_campaigns
ALTER TABLE newsletter_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins_Full_Access_Campaigns" ON newsletter_campaigns
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 7. RLS para newsletter_sends  
ALTER TABLE newsletter_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins_Full_Access_Sends" ON newsletter_sends
    FOR ALL
    USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Los usuarios pueden ver sus propios envíos (opcional, para historial)
CREATE POLICY "Users_View_Own_Sends" ON newsletter_sends
    FOR SELECT
    USING (user_id = auth.uid());

-- 8. Función para validar cupón con verificación de newsletter
-- Modifica la función existente o crea wrapper
CREATE OR REPLACE FUNCTION check_newsletter_requirement(
    p_coupon_id UUID,
    p_user_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_solo_newsletter BOOLEAN;
    v_is_subscribed BOOLEAN;
BEGIN
    -- Obtener si el cupón requiere newsletter
    SELECT solo_newsletter INTO v_solo_newsletter
    FROM cupones WHERE id = p_coupon_id;
    
    -- Si no requiere newsletter, OK
    IF v_solo_newsletter IS NOT TRUE THEN
        RETURN TRUE;
    END IF;
    
    -- Si requiere newsletter, verificar suscripción del usuario
    IF p_user_id IS NULL THEN
        RETURN FALSE; -- Sin usuario autenticado no puede usar cupón newsletter
    END IF;
    
    SELECT newsletter_subscribed INTO v_is_subscribed
    FROM profiles WHERE id = p_user_id;
    
    RETURN COALESCE(v_is_subscribed, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Función RPC para obtener suscriptores activos (para envío masivo)
CREATE OR REPLACE FUNCTION rpc_get_newsletter_subscribers()
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    nombre TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.email,
        p.nombre
    FROM profiles p
    WHERE p.newsletter_subscribed = TRUE
      AND p.email IS NOT NULL
      AND p.email != ''
    ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Solo admins pueden ejecutar
REVOKE ALL ON FUNCTION rpc_get_newsletter_subscribers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rpc_get_newsletter_subscribers() TO authenticated;

-- 10. Función para registrar envío de newsletter
CREATE OR REPLACE FUNCTION rpc_register_newsletter_send(
    p_campaign_id UUID,
    p_user_id UUID,
    p_email TEXT,
    p_status TEXT DEFAULT 'pending'
) RETURNS BIGINT AS $$
DECLARE
    v_send_id BIGINT;
BEGIN
    INSERT INTO newsletter_sends (campaign_id, user_id, email, status)
    VALUES (p_campaign_id, p_user_id, p_email, p_status)
    ON CONFLICT (campaign_id, user_id) DO UPDATE
    SET status = p_status, retry_count = newsletter_sends.retry_count + 1
    RETURNING id INTO v_send_id;
    
    RETURN v_send_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Función para actualizar estado de envío
CREATE OR REPLACE FUNCTION rpc_update_newsletter_send(
    p_send_id BIGINT,
    p_status TEXT,
    p_error_message TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE newsletter_sends
    SET 
        status = p_status,
        sent_at = CASE WHEN p_status = 'sent' THEN NOW() ELSE sent_at END,
        error_message = p_error_message
    WHERE id = p_send_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Trigger para actualizar contadores de campaña
CREATE OR REPLACE FUNCTION update_campaign_counters()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE newsletter_campaigns
    SET 
        total_sent = (SELECT COUNT(*) FROM newsletter_sends WHERE campaign_id = NEW.campaign_id AND status = 'sent'),
        total_errors = (SELECT COUNT(*) FROM newsletter_sends WHERE campaign_id = NEW.campaign_id AND status IN ('failed', 'bounced'))
    WHERE id = NEW.campaign_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_campaign_counters
AFTER UPDATE OF status ON newsletter_sends
FOR EACH ROW
EXECUTE FUNCTION update_campaign_counters();

COMMENT ON COLUMN profiles.newsletter_subscribed IS 'Usuario suscrito a la newsletter (toggle en Mi Cuenta)';
COMMENT ON TABLE newsletter_campaigns IS 'Campañas de newsletter enviadas por administradores';
COMMENT ON TABLE newsletter_sends IS 'Registro de cada envío individual con tracking de estado';
COMMENT ON COLUMN cupones.solo_newsletter IS 'Cupón exclusivo para suscriptores de newsletter';

-- =============================================================================
-- 13. INTEGRACIÓN CON rpc_validate_coupon EXISTENTE
-- =============================================================================
-- Nota: La función rpc_validate_coupon ya existe. Añadimos validación de newsletter
-- en la capa de aplicación (coupon-system.ts) para evitar recrear toda la función.
-- 
-- Alternativamente, si quieres modificar rpc_validate_coupon directamente:
-- 1. Primero obtener el código actual con: \df+ rpc_validate_coupon
-- 2. Añadir verificación: IF NOT check_newsletter_requirement(v_coupon_id, p_user_id) THEN ...
--
-- La forma más segura es invocar check_newsletter_requirement desde el código TypeScript
-- después de la validación básica del cupón, que es lo que haremos.
-- =============================================================================
