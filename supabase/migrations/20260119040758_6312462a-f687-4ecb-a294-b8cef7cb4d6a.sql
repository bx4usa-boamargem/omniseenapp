-- FASE 1: OmniCore Territorial - Atualização do template WhatsApp global
-- Adiciona placeholders territoriais: neighborhood, territory_name, lead_source

UPDATE global_comm_config
SET
  message_template = 'Olá! Encontrei sua empresa ao buscar por {service} em {neighborhood}. Li o artigo "{article_title}" no blog da unidade {territory_name} e gostaria de falar com um especialista local.',
  placeholders = '["phone","service","city","article_title","company_name","neighborhood","territory_name","lead_source"]'::jsonb,
  updated_at = now()
WHERE config_key = 'whatsapp_default';

-- Se não existir registro, criar um novo
INSERT INTO global_comm_config (config_key, whatsapp_base_url, message_template, placeholders, is_active, created_at, updated_at)
SELECT 
  'whatsapp_default',
  'https://wa.me/{phone}?text={message}',
  'Olá! Encontrei sua empresa ao buscar por {service} em {neighborhood}. Li o artigo "{article_title}" no blog da unidade {territory_name} e gostaria de falar com um especialista local.',
  '["phone","service","city","article_title","company_name","neighborhood","territory_name","lead_source"]'::jsonb,
  true,
  now(),
  now()
WHERE NOT EXISTS (SELECT 1 FROM global_comm_config WHERE config_key = 'whatsapp_default');