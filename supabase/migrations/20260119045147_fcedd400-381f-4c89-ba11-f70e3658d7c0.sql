-- Table for SEO AI correction auditing
CREATE TABLE seo_ai_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('fix_title', 'fix_meta', 'expand_content', 'fix_density', 'fix_all')),
  provider TEXT NOT NULL CHECK (provider IN ('gpt', 'gemini', 'lovable')),
  model TEXT,
  before JSONB,
  after JSONB,
  before_score INTEGER,
  after_score INTEGER,
  word_count_before INTEGER,
  word_count_after INTEGER,
  keyword_density_before JSONB,
  keyword_density_after JSONB,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_seo_ai_runs_article ON seo_ai_runs(article_id);
CREATE INDEX idx_seo_ai_runs_created ON seo_ai_runs(created_at DESC);
CREATE INDEX idx_seo_ai_runs_status ON seo_ai_runs(status);

-- Enable RLS
ALTER TABLE seo_ai_runs ENABLE ROW LEVEL SECURITY;

-- Users can view runs for their articles
CREATE POLICY "Users can view runs for their articles"
  ON seo_ai_runs FOR SELECT
  USING (
    article_id IN (
      SELECT a.id FROM articles a
      JOIN blogs b ON a.blog_id = b.id
      WHERE b.user_id = auth.uid()
    )
  );

-- Service role can manage all runs
CREATE POLICY "Service role can manage runs"
  ON seo_ai_runs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);