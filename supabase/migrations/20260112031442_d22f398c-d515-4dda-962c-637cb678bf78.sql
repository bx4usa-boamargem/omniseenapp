-- Adicionar coluna WhatsApp ao perfil da empresa
ALTER TABLE business_profile 
ADD COLUMN IF NOT EXISTS whatsapp TEXT;

COMMENT ON COLUMN business_profile.whatsapp IS 'WhatsApp da empresa no formato internacional (ex: 5511999999999)';