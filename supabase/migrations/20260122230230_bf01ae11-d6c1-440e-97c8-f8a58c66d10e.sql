-- ═══════════════════════════════════════════════════════════════════
-- SERP ANALYSIS CACHE: Armazena análises de concorrência
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE public.serp_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID REFERENCES public.blogs(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  territory TEXT,
  matrix JSONB NOT NULL,
  competitors_count INTEGER DEFAULT 0,
  avg_words INTEGER,
  avg_h2 INTEGER,
  avg_images INTEGER,
  common_terms TEXT[],
  analyzed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '24 hours',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookup
CREATE INDEX idx_serp_cache_keyword ON public.serp_analysis_cache(keyword, territory);
CREATE INDEX idx_serp_cache_blog ON public.serp_analysis_cache(blog_id);
CREATE INDEX idx_serp_cache_expires ON public.serp_analysis_cache(expires_at);

-- Enable RLS
ALTER TABLE public.serp_analysis_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view SERP analysis for their blogs"
ON public.serp_analysis_cache
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.blogs 
    WHERE blogs.id = serp_analysis_cache.blog_id 
    AND blogs.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE team_members.blog_id = serp_analysis_cache.blog_id 
    AND team_members.user_id = auth.uid()
    AND team_members.status = 'accepted'
  )
);

CREATE POLICY "Service role can manage SERP analysis"
ON public.serp_analysis_cache
FOR ALL
USING (true)
WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- ARTICLE CONTENT SCORES: Pontuação de conteúdo vs mercado
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE public.article_content_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
  serp_analysis_id UUID REFERENCES public.serp_analysis_cache(id) ON DELETE SET NULL,
  total_score INTEGER NOT NULL,
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  comparison JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  word_count INTEGER,
  h2_count INTEGER,
  paragraph_count INTEGER,
  image_count INTEGER,
  semantic_coverage DECIMAL(5,2),
  meets_market_standards BOOLEAN DEFAULT false,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(article_id)
);

-- Indexes
CREATE INDEX idx_content_scores_article ON public.article_content_scores(article_id);
CREATE INDEX idx_content_scores_serp ON public.article_content_scores(serp_analysis_id);
CREATE INDEX idx_content_scores_total ON public.article_content_scores(total_score);

-- Enable RLS
ALTER TABLE public.article_content_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view scores for their articles"
ON public.article_content_scores
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.articles a
    JOIN public.blogs b ON a.blog_id = b.id
    WHERE a.id = article_content_scores.article_id 
    AND b.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.articles a
    JOIN public.team_members tm ON a.blog_id = tm.blog_id
    WHERE a.id = article_content_scores.article_id 
    AND tm.user_id = auth.uid()
    AND tm.status = 'accepted'
  )
);

CREATE POLICY "Service role can manage content scores"
ON public.article_content_scores
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_content_scores_updated_at
BEFORE UPDATE ON public.article_content_scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();