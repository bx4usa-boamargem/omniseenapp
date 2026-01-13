-- PARTE 1: Adicionar funnel_stage em article_opportunities
ALTER TABLE article_opportunities
ADD COLUMN IF NOT EXISTS funnel_stage text;

-- Índice para performance nas queries por estágio
CREATE INDEX IF NOT EXISTS idx_opportunities_funnel_stage 
ON article_opportunities(blog_id, funnel_stage, status);

-- Popular retroativamente baseado no goal existente
UPDATE article_opportunities 
SET funnel_stage = CASE 
  WHEN goal = 'lead' THEN 'topo'
  WHEN goal = 'authority' THEN 'meio'
  WHEN goal = 'conversion' THEN 'fundo'
  ELSE 'topo'
END
WHERE funnel_stage IS NULL;

-- PARTE 2: Adicionar opportunity_id em articles para rastreabilidade
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES article_opportunities(id);

-- Índice para rastreamento bidirecional
CREATE INDEX IF NOT EXISTS idx_articles_opportunity 
ON articles(opportunity_id);

-- PARTE 3: Adicionar campos de Autopilot em blog_automation
ALTER TABLE blog_automation
ADD COLUMN IF NOT EXISTS funnel_autopilot boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS autopilot_top integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS autopilot_middle integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS autopilot_bottom integer DEFAULT 1;