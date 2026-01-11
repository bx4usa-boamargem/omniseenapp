-- Create article_revisions table for tracking changes and enabling undo
CREATE TABLE article_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  field_changed TEXT NOT NULL,
  original_value TEXT,
  new_value TEXT,
  optimization_type TEXT,
  score_before INTEGER,
  score_after INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_article_revisions_article ON article_revisions(article_id);
CREATE INDEX idx_article_revisions_user ON article_revisions(user_id);
CREATE INDEX idx_article_revisions_created ON article_revisions(created_at DESC);

-- Enable RLS
ALTER TABLE article_revisions ENABLE ROW LEVEL SECURITY;

-- Policy: users can manage revisions for their own articles
CREATE POLICY "Users can manage their article revisions"
ON article_revisions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM articles a 
    JOIN blogs b ON a.blog_id = b.id 
    WHERE a.id = article_revisions.article_id 
    AND b.user_id = auth.uid()
  )
);