-- =====================================================
-- MODELO DE CONVERSÃO EM 2 ETAPAS (VISIBILIDADE → INTENÇÃO)
-- =====================================================

-- 1. Adicionar colunas de conversão em articles
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS conversion_visibility_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_intent_count INTEGER DEFAULT 0;

-- 2. Adicionar colunas em business_profile para valores
ALTER TABLE business_profile 
ADD COLUMN IF NOT EXISTS value_per_visibility DECIMAL(10,2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS value_per_intent DECIMAL(10,2) DEFAULT 50.00;

-- 3. Criar tabela article_conversion_metrics (cache agregado por artigo/dia)
CREATE TABLE IF NOT EXISTS article_conversion_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Métricas de volume
  views_total INTEGER DEFAULT 0,
  reads_total INTEGER DEFAULT 0,
  
  -- Conversões oficiais
  conversion_visibility_count INTEGER DEFAULT 0,
  conversion_intent_count INTEGER DEFAULT 0,
  
  -- Valor calculado
  visibility_value DECIMAL(10,2) DEFAULT 0,
  intent_value DECIMAL(10,2) DEFAULT 0,
  total_value DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(article_id, date)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_article_conversion_metrics_blog_date 
ON article_conversion_metrics(blog_id, date);

CREATE INDEX IF NOT EXISTS idx_article_conversion_metrics_article 
ON article_conversion_metrics(article_id);

-- RLS
ALTER TABLE article_conversion_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their conversion metrics" ON article_conversion_metrics;
CREATE POLICY "Users can view their conversion metrics"
ON article_conversion_metrics FOR SELECT
USING (EXISTS (
  SELECT 1 FROM blogs 
  WHERE blogs.id = article_conversion_metrics.blog_id 
  AND blogs.user_id = auth.uid()
));

DROP POLICY IF EXISTS "System can insert conversion metrics" ON article_conversion_metrics;
CREATE POLICY "System can insert conversion metrics"
ON article_conversion_metrics FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "System can update conversion metrics" ON article_conversion_metrics;
CREATE POLICY "System can update conversion metrics"
ON article_conversion_metrics FOR UPDATE
USING (true);

-- 4. Criar RPC para incrementar contadores de visibilidade
CREATE OR REPLACE FUNCTION increment_visibility_count(p_article_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE articles 
  SET conversion_visibility_count = COALESCE(conversion_visibility_count, 0) + 1
  WHERE id = p_article_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Criar RPC para incrementar contadores de intenção
CREATE OR REPLACE FUNCTION increment_intent_count(p_article_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE articles 
  SET conversion_intent_count = COALESCE(conversion_intent_count, 0) + 1
  WHERE id = p_article_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;