-- ═══════════════════════════════════════════════════════════════════
-- DETERMINISTIC CONTENT ENGINE: Database Evolution
-- Motor de Conteúdo Baseado em SERP Real
-- ═══════════════════════════════════════════════════════════════════

-- 1. Expand serp_analysis_cache with deterministic fields
ALTER TABLE serp_analysis_cache
ADD COLUMN IF NOT EXISTS min_words INTEGER,
ADD COLUMN IF NOT EXISTS max_words INTEGER,
ADD COLUMN IF NOT EXISTS min_h2 INTEGER,
ADD COLUMN IF NOT EXISTS max_h2 INTEGER,
ADD COLUMN IF NOT EXISTS min_images INTEGER,
ADD COLUMN IF NOT EXISTS max_images INTEGER,
ADD COLUMN IF NOT EXISTS keyword_frequency_map JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS meta_patterns JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS keyword_presence JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS serp_hash TEXT,
ADD COLUMN IF NOT EXISTS scrape_method TEXT DEFAULT 'perplexity';

-- 2. Add content_hash and last_content_change_at to articles
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS content_hash TEXT,
ADD COLUMN IF NOT EXISTS last_content_change_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS serp_hash_at_calculation TEXT;

-- 3. Create index for efficient hash lookups
CREATE INDEX IF NOT EXISTS idx_articles_content_hash ON articles(content_hash);
CREATE INDEX IF NOT EXISTS idx_serp_analysis_serp_hash ON serp_analysis_cache(serp_hash);

-- 4. Add comment for documentation
COMMENT ON COLUMN serp_analysis_cache.keyword_frequency_map IS 'Map of term -> {occurrences, avgFrequency, positions[]}';
COMMENT ON COLUMN serp_analysis_cache.keyword_presence IS 'Percentage of competitors with keyword in title, h1, h2, meta, firstParagraph';
COMMENT ON COLUMN serp_analysis_cache.serp_hash IS 'Hash of SERP results to detect market changes';
COMMENT ON COLUMN articles.content_hash IS 'SHA-256 hash of normalized content for change detection';
COMMENT ON COLUMN articles.serp_hash_at_calculation IS 'SERP hash used at last score calculation';