-- Create table for daily SEO snapshots
CREATE TABLE public.seo_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  avg_score INTEGER NOT NULL,
  total_articles INTEGER NOT NULL DEFAULT 0,
  articles_below_60 INTEGER DEFAULT 0,
  articles_above_80 INTEGER DEFAULT 0,
  optimizations_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(blog_id, snapshot_date)
);

-- Create index for efficient queries
CREATE INDEX idx_seo_snapshots_blog_date ON seo_daily_snapshots(blog_id, snapshot_date DESC);

-- Enable RLS
ALTER TABLE seo_daily_snapshots ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their blog snapshots
CREATE POLICY "Users can view their blog snapshots" ON seo_daily_snapshots
  FOR SELECT USING (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()));

-- Policy for authenticated users to insert snapshots for their blogs
CREATE POLICY "Users can insert snapshots for their blogs" ON seo_daily_snapshots
  FOR INSERT WITH CHECK (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()));

-- Policy for authenticated users to update their blog snapshots
CREATE POLICY "Users can update their blog snapshots" ON seo_daily_snapshots
  FOR UPDATE USING (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()));