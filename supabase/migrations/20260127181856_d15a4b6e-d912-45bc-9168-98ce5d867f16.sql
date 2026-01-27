-- Adicionar campo de template WhatsApp customizado por tenant
ALTER TABLE business_profile 
ADD COLUMN IF NOT EXISTS whatsapp_lead_template TEXT;

COMMENT ON COLUMN business_profile.whatsapp_lead_template IS 
'Template customizado para mensagens de WhatsApp. Suporta: {{titulo}}, {{pagina}}, {{servico}}';