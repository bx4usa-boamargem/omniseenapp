-- V4.0: Add columns for SEO async enhancement tracking
-- These columns track when the background seo-enhancer-job has processed an article

-- Add serp_enhanced flag
ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS serp_enhanced BOOLEAN DEFAULT FALSE;

-- Add timestamp for when enhancement occurred
ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS serp_enhanced_at TIMESTAMPTZ;

-- Add index for finding articles pending enhancement
CREATE INDEX IF NOT EXISTS idx_articles_serp_pending 
  ON articles(blog_id, serp_enhanced) 
  WHERE serp_enhanced = FALSE;

-- Comment for documentation
COMMENT ON COLUMN articles.serp_enhanced IS 'Whether the background SEO enhancer job has processed this article';
COMMENT ON COLUMN articles.serp_enhanced_at IS 'Timestamp when the SEO enhancement job completed';