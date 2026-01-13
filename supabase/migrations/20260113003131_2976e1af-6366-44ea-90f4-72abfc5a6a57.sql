
-- Criar tabela para tracking de métricas agregadas do Consultor Comercial
CREATE TABLE IF NOT EXISTS consultant_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id uuid REFERENCES blogs(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  
  -- Oportunidades
  total_opportunities integer DEFAULT 0,
  high_score_opportunities integer DEFAULT 0,
  medium_score_opportunities integer DEFAULT 0,
  low_score_opportunities integer DEFAULT 0,
  
  -- Conversão
  converted_to_articles integer DEFAULT 0,
  published_articles integer DEFAULT 0,
  
  -- Engagement
  total_views integer DEFAULT 0,
  total_shares integer DEFAULT 0,
  
  -- ROI Estimado
  estimated_value_usd numeric(10,2) DEFAULT 0,
  
  created_at timestamptz DEFAULT now(),
  
  UNIQUE(blog_id, date)
);

-- Habilitar RLS
ALTER TABLE consultant_metrics_daily ENABLE ROW LEVEL SECURITY;

-- Policy simples para usuários do blog
CREATE POLICY "Users can view their blog metrics"
  ON consultant_metrics_daily FOR SELECT
  USING (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()));

-- Policy para inserir/atualizar métricas
CREATE POLICY "Users can manage their blog metrics"
  ON consultant_metrics_daily FOR ALL
  USING (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()));

-- Adicionar colunas à tabela de notificações
ALTER TABLE opportunity_notifications
ADD COLUMN IF NOT EXISTS notify_whatsapp boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_number text,
ADD COLUMN IF NOT EXISTS notify_high_score_only boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS high_score_threshold integer DEFAULT 90,
ADD COLUMN IF NOT EXISTS daily_digest boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS digest_time time DEFAULT '09:00',
ADD COLUMN IF NOT EXISTS notification_frequency text DEFAULT 'immediate';

-- Adicionar colunas ao business_profile para o Consultor Comercial
ALTER TABLE business_profile
ADD COLUMN IF NOT EXISTS services text,
ADD COLUMN IF NOT EXISTS city text;

-- Adicionar colunas ao market_intel_weekly para contexto comercial
ALTER TABLE market_intel_weekly
ADD COLUMN IF NOT EXISTS business_context jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS analysis_period text DEFAULT 'last_7_days',
ADD COLUMN IF NOT EXISTS generated_at timestamptz DEFAULT now();

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_consultant_metrics_blog_date ON consultant_metrics_daily(blog_id, date DESC);
