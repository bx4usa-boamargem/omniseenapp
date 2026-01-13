-- Adicionar colunas para vincular gap ao concorrente específico
ALTER TABLE article_opportunities 
ADD COLUMN IF NOT EXISTS competitor_id uuid REFERENCES competitors(id) ON DELETE SET NULL;

-- Adicionar coluna para o nome do concorrente (para exibição mesmo se deletado)
ALTER TABLE article_opportunities 
ADD COLUMN IF NOT EXISTS competitor_name text;

-- Criar índice para buscas por concorrente
CREATE INDEX IF NOT EXISTS idx_opportunities_competitor 
ON article_opportunities(competitor_id) WHERE competitor_id IS NOT NULL;