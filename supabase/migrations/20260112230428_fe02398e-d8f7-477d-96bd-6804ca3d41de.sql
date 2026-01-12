-- ================================================================
-- FASE 1: Sistema de Inteligência de Mercado Semanal
-- ================================================================

-- 1. Tabela market_intel_weekly - Armazena o pacote semanal
CREATE TABLE market_intel_weekly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  week_of DATE NOT NULL,
  country TEXT NOT NULL DEFAULT 'BR',
  
  -- Dados do pacote
  market_snapshot TEXT,
  trends JSONB DEFAULT '[]',
  questions JSONB DEFAULT '[]',
  keywords JSONB DEFAULT '[]',
  competitor_gaps JSONB DEFAULT '[]',
  content_ideas JSONB DEFAULT '[]',
  
  -- Metadados
  source TEXT DEFAULT 'perplexity',
  query_cost_usd NUMERIC DEFAULT 0.0057,
  sources_count INTEGER DEFAULT 0,
  raw_response JSONB,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(blog_id, week_of)
);

-- Índices para performance
CREATE INDEX idx_market_intel_blog_week ON market_intel_weekly(blog_id, week_of DESC);

-- Enable RLS
ALTER TABLE market_intel_weekly ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their intel"
  ON market_intel_weekly FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM blogs WHERE blogs.id = market_intel_weekly.blog_id 
    AND blogs.user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all intel"
  ON market_intel_weekly FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage intel"
  ON market_intel_weekly FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 2. Tabela ai_usage_logs - Registra execuções para controle de custos
CREATE TABLE ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID REFERENCES blogs(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  country TEXT,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_ai_usage_logs_blog ON ai_usage_logs(blog_id);
CREATE INDEX idx_ai_usage_logs_created ON ai_usage_logs(created_at DESC);
CREATE INDEX idx_ai_usage_logs_provider ON ai_usage_logs(provider);

-- Enable RLS
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all logs"
  ON ai_usage_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage logs"
  ON ai_usage_logs FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- 3. Adicionar colunas em article_opportunities para vincular ao pacote semanal
ALTER TABLE article_opportunities
  ADD COLUMN IF NOT EXISTS intel_week_id UUID REFERENCES market_intel_weekly(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS source_urls TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS why_now TEXT,
  ADD COLUMN IF NOT EXISTS goal TEXT;

-- Índice para buscar oportunidades por origem
CREATE INDEX idx_article_opportunities_origin ON article_opportunities(origin);

-- Enable realtime for market_intel_weekly
ALTER PUBLICATION supabase_realtime ADD TABLE market_intel_weekly;