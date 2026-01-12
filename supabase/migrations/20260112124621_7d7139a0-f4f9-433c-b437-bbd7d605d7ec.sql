-- ========================================
-- REGRA 5: AUTOMAÇÕES DE SAÚDE DO BLOG
-- ========================================

-- Tabela para relatórios SEO semanais
CREATE TABLE IF NOT EXISTS public.seo_weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Métricas
  total_articles INTEGER DEFAULT 0,
  avg_seo_score INTEGER DEFAULT 0,
  articles_below_60 INTEGER DEFAULT 0,
  articles_improved INTEGER DEFAULT 0,
  score_change INTEGER DEFAULT 0,
  
  -- Detalhes
  weak_articles JSONB DEFAULT '[]',
  top_suggestions JSONB DEFAULT '[]',
  
  -- Período
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  sent_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para seo_weekly_reports
ALTER TABLE public.seo_weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own SEO reports" ON public.seo_weekly_reports
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can manage SEO reports" ON public.seo_weekly_reports
  FOR ALL USING (true) WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_seo_reports_blog ON public.seo_weekly_reports(blog_id);
CREATE INDEX IF NOT EXISTS idx_seo_reports_date ON public.seo_weekly_reports(week_start DESC);

-- Tabela para links quebrados
CREATE TABLE IF NOT EXISTS public.article_broken_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  blog_id UUID NOT NULL,
  
  -- Detalhes do link
  url TEXT NOT NULL,
  anchor_text TEXT,
  status_code INTEGER,
  error_message TEXT,
  
  -- Status
  is_fixed BOOLEAN DEFAULT FALSE,
  fixed_at TIMESTAMPTZ,
  fix_method TEXT,
  
  -- Timestamps
  detected_at TIMESTAMPTZ DEFAULT now(),
  last_checked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique constraint
  UNIQUE(article_id, url)
);

-- RLS para article_broken_links
ALTER TABLE public.article_broken_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view broken links for their articles" ON public.article_broken_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM articles a 
      JOIN blogs b ON a.blog_id = b.id 
      WHERE a.id = article_broken_links.article_id 
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage broken links for their articles" ON public.article_broken_links
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM articles a 
      JOIN blogs b ON a.blog_id = b.id 
      WHERE a.id = article_broken_links.article_id 
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all broken links" ON public.article_broken_links
  FOR ALL USING (true) WITH CHECK (true);

-- Índices para broken links
CREATE INDEX IF NOT EXISTS idx_broken_links_blog ON public.article_broken_links(blog_id) WHERE NOT is_fixed;
CREATE INDEX IF NOT EXISTS idx_broken_links_article ON public.article_broken_links(article_id);