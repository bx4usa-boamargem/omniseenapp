-- ============================================================================
-- FASE 1: ARQUITETURA DETERMINÍSTICA POR CAMADAS
-- Feature Flags, Versionamento de Conteúdo, Log de Score
-- ============================================================================

-- 1. Tabela de Feature Flags por Subconta
CREATE TABLE IF NOT EXISTS public.blog_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  flag_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blog_id, flag_name)
);

-- RLS para blog_feature_flags
ALTER TABLE public.blog_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to blog_feature_flags"
ON public.blog_feature_flags
FOR ALL
USING (true)
WITH CHECK (true);

-- 2. Ativar FEATURE_VERSIONED_CONTENT apenas no Bione
INSERT INTO public.blog_feature_flags (blog_id, flag_name, is_enabled)
VALUES ('8608656b-393e-4014-b365-dec11a67960e', 'FEATURE_VERSIONED_CONTENT', true)
ON CONFLICT (blog_id, flag_name) DO UPDATE SET is_enabled = true, updated_at = now();

-- 3. Expandir article_versions com campos de controle
ALTER TABLE public.article_versions 
ADD COLUMN IF NOT EXISTS layer_type TEXT,
ADD COLUMN IF NOT EXISTS change_source TEXT,
ADD COLUMN IF NOT EXISTS change_reason TEXT,
ADD COLUMN IF NOT EXISTS changed_by TEXT,
ADD COLUMN IF NOT EXISTS word_count INTEGER,
ADD COLUMN IF NOT EXISTS score_at_save INTEGER;

-- Adicionar constraint de layer_type (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'article_versions_layer_type_check'
  ) THEN
    ALTER TABLE public.article_versions 
    ADD CONSTRAINT article_versions_layer_type_check 
    CHECK (layer_type IS NULL OR layer_type IN ('base', 'semantic', 'optimized'));
  END IF;
END $$;

-- Adicionar constraint de changed_by (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'article_versions_changed_by_check'
  ) THEN
    ALTER TABLE public.article_versions 
    ADD CONSTRAINT article_versions_changed_by_check 
    CHECK (changed_by IS NULL OR changed_by IN ('user', 'system'));
  END IF;
END $$;

-- 4. Tabela de log de alterações de score
CREATE TABLE IF NOT EXISTS public.score_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  old_score INTEGER,
  new_score INTEGER,
  change_reason TEXT NOT NULL,
  triggered_by TEXT NOT NULL,
  content_version INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar constraint de triggered_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'score_change_log_triggered_by_check'
  ) THEN
    ALTER TABLE public.score_change_log 
    ADD CONSTRAINT score_change_log_triggered_by_check 
    CHECK (triggered_by IN ('user', 'system', 'background'));
  END IF;
END $$;

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_score_change_log_article ON public.score_change_log(article_id, created_at DESC);

-- RLS para score_change_log (service_role only para escrita)
ALTER TABLE public.score_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to score_change_log"
ON public.score_change_log
FOR ALL
USING (true)
WITH CHECK (true);

-- 5. Adicionar content_version em article_content_scores
ALTER TABLE public.article_content_scores 
ADD COLUMN IF NOT EXISTS content_version INTEGER;

-- 6. Adicionar campos de controle em articles
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS content_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_user_action TEXT,
ADD COLUMN IF NOT EXISTS last_user_action_at TIMESTAMPTZ;

-- 7. Trigger para atualizar updated_at em blog_feature_flags
CREATE OR REPLACE FUNCTION update_blog_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_blog_feature_flags_updated_at ON public.blog_feature_flags;
CREATE TRIGGER update_blog_feature_flags_updated_at
BEFORE UPDATE ON public.blog_feature_flags
FOR EACH ROW
EXECUTE FUNCTION update_blog_feature_flags_updated_at();