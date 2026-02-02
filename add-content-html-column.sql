-- Agregar columna content_html a newsletter_campaigns si no existe
ALTER TABLE newsletter_campaigns
ADD COLUMN IF NOT EXISTS content_html TEXT;

-- Comentario
COMMENT ON COLUMN newsletter_campaigns.content_html IS 'HTML compilado del email (generado desde content_blocks)';
