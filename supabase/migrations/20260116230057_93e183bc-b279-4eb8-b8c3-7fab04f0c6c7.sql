-- =====================================================
-- QUALITY GATE: Infraestrutura para Modo 100% Autônomo
-- =====================================================

-- 1. Tabela de Auditoria do Quality Gate
CREATE TABLE public.quality_gate_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
  attempt_number INTEGER DEFAULT 1,
  approved BOOLEAN NOT NULL,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  failures JSONB DEFAULT '[]',
  warnings JSONB DEFAULT '[]',
  fix_suggestions JSONB DEFAULT '[]',
  word_count INTEGER,
  similarity_score NUMERIC,
  seo_score INTEGER,
  compliance_passed BOOLEAN,
  auto_fix_applied BOOLEAN DEFAULT false,
  auto_fix_changes JSONB,
  validated_at TIMESTAMPTZ DEFAULT now(),
  validator_version TEXT DEFAULT 'v1.0'
);

-- Índices para performance
CREATE INDEX idx_quality_gate_audits_article ON public.quality_gate_audits(article_id);
CREATE INDEX idx_quality_gate_audits_blog ON public.quality_gate_audits(blog_id);
CREATE INDEX idx_quality_gate_audits_approved ON public.quality_gate_audits(approved);
CREATE INDEX idx_quality_gate_audits_validated_at ON public.quality_gate_audits(validated_at DESC);

-- RLS para quality_gate_audits
ALTER TABLE public.quality_gate_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audits for their blogs"
ON public.quality_gate_audits FOR SELECT
USING (
  blog_id IN (
    SELECT id FROM public.blogs WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'platform_admin')
);

-- 2. Tabela de Log de Aprendizado de Performance
CREATE TABLE public.performance_learning_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
  analysis_period_start DATE NOT NULL,
  analysis_period_end DATE NOT NULL,
  previous_distribution JSONB NOT NULL,
  new_distribution JSONB NOT NULL,
  performance_data JSONB NOT NULL,
  decision_rationale TEXT,
  applied_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_performance_learning_blog ON public.performance_learning_log(blog_id);
CREATE INDEX idx_performance_learning_applied ON public.performance_learning_log(applied_at DESC);

-- RLS para performance_learning_log
ALTER TABLE public.performance_learning_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view learning logs for their blogs"
ON public.performance_learning_log FOR SELECT
USING (
  blog_id IN (
    SELECT id FROM public.blogs WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'platform_admin')
);

-- 3. Tabela de Submissões IndexNow
CREATE TABLE public.indexnow_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
  url_submitted TEXT NOT NULL,
  search_engine TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_indexnow_article ON public.indexnow_submissions(article_id);
CREATE INDEX idx_indexnow_blog ON public.indexnow_submissions(blog_id);
CREATE INDEX idx_indexnow_submitted ON public.indexnow_submissions(submitted_at DESC);

-- RLS para indexnow_submissions
ALTER TABLE public.indexnow_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view indexnow submissions for their blogs"
ON public.indexnow_submissions FOR SELECT
USING (
  blog_id IN (
    SELECT id FROM public.blogs WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'platform_admin')
);

-- 4. Adicionar colunas à tabela articles
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS ready_for_publish_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS quality_gate_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS quality_gate_attempts INTEGER DEFAULT 0;

-- Add check constraint separately
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'articles_quality_gate_status_check'
  ) THEN
    ALTER TABLE public.articles 
    ADD CONSTRAINT articles_quality_gate_status_check 
    CHECK (quality_gate_status IN ('pending', 'approved', 'blocked', 'bypassed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_articles_ready_for_publish ON public.articles(ready_for_publish_at) 
WHERE status = 'ready_for_publish';

CREATE INDEX IF NOT EXISTS idx_articles_quality_gate_status ON public.articles(quality_gate_status);

-- 5. Adicionar colunas à tabela blog_automation
ALTER TABLE public.blog_automation
ADD COLUMN IF NOT EXISTS auto_publish_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS min_word_count INTEGER DEFAULT 800,
ADD COLUMN IF NOT EXISTS quality_gate_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS auto_fix_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS max_auto_fix_attempts INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS publish_delay_hours INTEGER DEFAULT 24;

-- 6. Adicionar coluna de performance boost às oportunidades
ALTER TABLE public.article_opportunities
ADD COLUMN IF NOT EXISTS performance_boost INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_opportunities_boosted ON public.article_opportunities(performance_boost DESC)
WHERE status IN ('pending', 'approved');