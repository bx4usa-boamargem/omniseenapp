-- ============================================
-- OMNICORE TABLES - Territorial Intelligence Engine
-- ============================================

-- 1. Sinais de mercado por território (Perplexity = Eyes)
CREATE TABLE omnicore_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  territory TEXT NOT NULL,
  niche TEXT NOT NULL,
  topic TEXT NOT NULL,
  intent TEXT DEFAULT 'informational',
  volume_hint TEXT DEFAULT 'medium',
  sources JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Oportunidades OmniCore (link para article_opportunities existente)
CREATE TABLE omnicore_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES omnicore_signals(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES article_opportunities(id) ON DELETE SET NULL,
  territory TEXT NOT NULL,
  slug TEXT,
  title TEXT NOT NULL,
  angle TEXT DEFAULT 'local-authority',
  primary_kw TEXT,
  secondary_kw TEXT[],
  intent TEXT DEFAULT 'informational',
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Outlines de artigos (Gemini = Architect)
CREATE TABLE omnicore_outlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  omnicore_opportunity_id UUID NOT NULL REFERENCES omnicore_opportunities(id) ON DELETE CASCADE,
  outline JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Artigos OmniCore (LEVE - sem duplicar HTML, articles é a fonte de verdade)
CREATE TABLE omnicore_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  omnicore_opportunity_id UUID REFERENCES omnicore_opportunities(id) ON DELETE SET NULL,
  outline_id UUID REFERENCES omnicore_outlines(id) ON DELETE SET NULL,
  signal_id UUID REFERENCES omnicore_signals(id) ON DELETE SET NULL,
  word_count INT NOT NULL DEFAULT 0,
  writer_model TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Reviews de qualidade (Gemini = Auditor/QA)
CREATE TABLE omnicore_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  omnicore_article_id UUID NOT NULL REFERENCES omnicore_articles(id) ON DELETE CASCADE,
  approved BOOLEAN DEFAULT false,
  score INT DEFAULT 0,
  issues JSONB DEFAULT '[]',
  suggestions JSONB DEFAULT '[]',
  qa_model TEXT DEFAULT 'google/gemini-2.5-flash',
  word_count_validated INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDICES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_omnicore_signals_blog ON omnicore_signals(blog_id);
CREATE INDEX idx_omnicore_signals_territory ON omnicore_signals(territory);
CREATE INDEX idx_omnicore_opportunities_blog ON omnicore_opportunities(blog_id);
CREATE INDEX idx_omnicore_opportunities_status ON omnicore_opportunities(status);
CREATE INDEX idx_omnicore_articles_article ON omnicore_articles(article_id);
CREATE INDEX idx_omnicore_articles_status ON omnicore_articles(status);
CREATE INDEX idx_omnicore_reviews_approved ON omnicore_reviews(approved) WHERE approved = true;
CREATE INDEX idx_omnicore_reviews_article ON omnicore_reviews(omnicore_article_id);

-- ============================================
-- RLS POLICIES (MVP - No recursive subqueries)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE omnicore_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE omnicore_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE omnicore_outlines ENABLE ROW LEVEL SECURITY;
ALTER TABLE omnicore_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE omnicore_reviews ENABLE ROW LEVEL SECURITY;

-- omnicore_signals: READ by owner/admin only
CREATE POLICY "omnicore_signals_select" ON omnicore_signals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM blogs WHERE blogs.id = blog_id AND blogs.user_id = auth.uid())
    OR has_role('platform_admin')
  );

-- omnicore_opportunities: READ by owner/admin only
CREATE POLICY "omnicore_opportunities_select" ON omnicore_opportunities
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM blogs WHERE blogs.id = blog_id AND blogs.user_id = auth.uid())
    OR has_role('platform_admin')
  );

-- omnicore_outlines: READ via opportunity owner
CREATE POLICY "omnicore_outlines_select" ON omnicore_outlines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM omnicore_opportunities o
      JOIN blogs b ON b.id = o.blog_id
      WHERE o.id = omnicore_opportunity_id AND b.user_id = auth.uid()
    )
    OR has_role('platform_admin')
  );

-- omnicore_articles: READ via article owner
CREATE POLICY "omnicore_articles_select" ON omnicore_articles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM articles a
      JOIN blogs b ON b.id = a.blog_id
      WHERE a.id = article_id AND b.user_id = auth.uid()
    )
    OR has_role('platform_admin')
  );

-- omnicore_reviews: READ via article owner
CREATE POLICY "omnicore_reviews_select" ON omnicore_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM omnicore_articles oa
      JOIN articles a ON a.id = oa.article_id
      JOIN blogs b ON b.id = a.blog_id
      WHERE oa.id = omnicore_article_id AND b.user_id = auth.uid()
    )
    OR has_role('platform_admin')
  );

-- NOTE: INSERT/UPDATE/DELETE operations are handled by service_role in edge functions
-- No explicit policies needed as service_role bypasses RLS