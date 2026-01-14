-- Add territory_id to article_opportunities for territorial tracking
ALTER TABLE article_opportunities 
ADD COLUMN IF NOT EXISTS territory_id uuid REFERENCES territories(id);

-- Index for territory-based queries
CREATE INDEX IF NOT EXISTS idx_opportunities_territory 
ON article_opportunities(territory_id);

-- Index for high score opportunity queries (for real-time alerts)
CREATE INDEX IF NOT EXISTS idx_opportunities_high_score 
ON article_opportunities(blog_id, relevance_score) 
WHERE relevance_score >= 90;

-- Index for territory metrics aggregation
CREATE INDEX IF NOT EXISTS idx_articles_territory 
ON articles(territory_id, blog_id, status);

-- Add high_score_alert_sent flag to prevent duplicate notifications
ALTER TABLE article_opportunities 
ADD COLUMN IF NOT EXISTS high_score_alert_sent boolean DEFAULT false;