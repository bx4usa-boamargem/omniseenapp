-- Adicionar campo whatsapp na tabela articles para CTA
ALTER TABLE articles ADD COLUMN IF NOT EXISTS whatsapp TEXT;

-- Índice para artigos GEO
CREATE INDEX IF NOT EXISTS idx_articles_geo 
ON articles (territory_id, status) 
WHERE territory_id IS NOT NULL;

-- Índice para artigos com whatsapp
CREATE INDEX IF NOT EXISTS idx_articles_whatsapp 
ON articles (blog_id) 
WHERE whatsapp IS NOT NULL;