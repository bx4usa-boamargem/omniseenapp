-- Etapa 1: Adicionar campos mode e content_type na tabela blog_automation

-- Campo de modo de automação (regra soberana)
ALTER TABLE blog_automation 
ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'auto';

COMMENT ON COLUMN blog_automation.mode IS 
'Nível de automação: manual (desativado), suggest (gera rascunhos), auto (publica automaticamente)';

-- Campo de tipo de conteúdo
ALTER TABLE blog_automation 
ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'educational';

COMMENT ON COLUMN blog_automation.content_type IS 
'Tipo de conteúdo: educational, seo_local, authority, mixed';

-- Índice para consultas por modo ativo
CREATE INDEX IF NOT EXISTS idx_blog_automation_mode_active 
ON blog_automation(mode, is_active) 
WHERE is_active = true;