-- Add publication tracking columns to articles table
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS publication_target TEXT DEFAULT 'cms',
ADD COLUMN IF NOT EXISTS publication_url TEXT;

COMMENT ON COLUMN articles.publication_target IS 'Target: cms (WordPress/Wix), domain (native), minisite';
COMMENT ON COLUMN articles.publication_url IS 'URL where the article was published';