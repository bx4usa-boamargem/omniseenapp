-- ============================================================
-- MÓDULO GEO — Fase 1: Tabelas de prontidão GEO e recomendações
-- Criado: 2026-04-01
-- Objetivo: Avaliar se artigos gerados são prontos para serem
--   citados por motores de IA (Gemini, ChatGPT, Perplexity).
-- Score híbrido: Entidade + Estrutura + Autoridade + Formato
-- ============================================================

-- Tabela principal de avaliação GEO por artigo
CREATE TABLE IF NOT EXISTS seo_geo_readiness (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id      uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  blog_id         uuid NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  tenant_id       uuid REFERENCES tenants(id) ON DELETE SET NULL,

  -- Score geral (0-100) e categorização
  geo_score       integer NOT NULL DEFAULT 0 CHECK (geo_score >= 0 AND geo_score <= 100),
  geo_tier        text NOT NULL DEFAULT 'baixo' CHECK (geo_tier IN ('baixo', 'medio', 'alto')),

  -- Sub-scores por dimensão (0-25 cada, total = 100)
  score_entity_coverage    integer NOT NULL DEFAULT 0, -- Cobertura de entidades semânticas
  score_structure          integer NOT NULL DEFAULT 0, -- Estrutura (H1-H3, FAQ, Answer-first)
  score_authority_signals  integer NOT NULL DEFAULT 0, -- Sinais de autoridade (dados, citações, estudos)
  score_format_readability integer NOT NULL DEFAULT 0, -- Formato escaneável, listas, parágrafos curtos

  -- Estatísticas do artigo avaliado
  word_count       integer,
  heading_count    integer,
  has_faq          boolean DEFAULT false,
  has_answer_first boolean DEFAULT false,
  has_statistics   boolean DEFAULT false,
  has_lists        boolean DEFAULT false,

  -- Metadados
  generation_mode  text,  -- 'economic' | 'premium' — modo que gerou o artigo
  evaluated_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),

  -- Índice único: 1 avaliação por artigo (upsert on conflict)
  CONSTRAINT uq_geo_readiness_article UNIQUE (article_id)
);

-- Tabela de recomendações GEO por artigo (múltiplas por avaliação)
CREATE TABLE IF NOT EXISTS geo_recommendations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_readiness_id    uuid NOT NULL REFERENCES seo_geo_readiness(id) ON DELETE CASCADE,
  article_id          uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,

  -- Dimensão e tipo da recomendação
  dimension           text NOT NULL CHECK (dimension IN ('entity_coverage', 'structure', 'authority_signals', 'format_readability')),
  priority            text NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),

  -- Conteúdo explicável
  recommendation_text text NOT NULL,  -- Ex: "Adicione dados estatísticos para reforçar autoridade"
  action_hint         text,           -- Ex: "Inclua percentuais, pesquisas ou fontes no H2 sobre X"

  -- Estado
  is_applied          boolean DEFAULT false,
  applied_at          timestamptz,

  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Índices para queries de performance
CREATE INDEX IF NOT EXISTS idx_geo_readiness_blog      ON seo_geo_readiness (blog_id);
CREATE INDEX IF NOT EXISTS idx_geo_readiness_tenant    ON seo_geo_readiness (tenant_id);
CREATE INDEX IF NOT EXISTS idx_geo_readiness_tier      ON seo_geo_readiness (geo_tier);
CREATE INDEX IF NOT EXISTS idx_geo_readiness_score     ON seo_geo_readiness (geo_score DESC);
CREATE INDEX IF NOT EXISTS idx_geo_recommendations_art ON geo_recommendations (article_id);
CREATE INDEX IF NOT EXISTS idx_geo_recommendations_dim ON geo_recommendations (dimension);

-- RLS: Cada tenant acessa apenas seus próprios dados
ALTER TABLE seo_geo_readiness ENABLE ROW LEVEL SECURITY;
ALTER TABLE geo_recommendations ENABLE ROW LEVEL SECURITY;

-- Policy: Service role tem acesso total (Edge Functions)
CREATE POLICY "service_role_geo_readiness" ON seo_geo_readiness
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_geo_recommendations" ON geo_recommendations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Policy: Authenticated users veem apenas seus próprios blogs
CREATE POLICY "authenticated_read_geo_readiness" ON seo_geo_readiness
  FOR SELECT TO authenticated
  USING (
    blog_id IN (
      SELECT id FROM blogs
      WHERE user_id = auth.uid() OR tenant_id IN (
        SELECT tenant_id FROM user_tenant_roles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "authenticated_read_geo_recommendations" ON geo_recommendations
  FOR SELECT TO authenticated
  USING (
    article_id IN (
      SELECT id FROM articles
      WHERE user_id = auth.uid() OR blog_id IN (
        SELECT id FROM blogs WHERE user_id = auth.uid()
      )
    )
  );
