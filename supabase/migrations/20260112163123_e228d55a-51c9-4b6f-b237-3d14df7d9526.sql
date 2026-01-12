-- ============================================
-- ARTICLE FINGERPRINT DEDUPLICATION SYSTEM
-- Prevents duplicate articles with same semantic title
-- ============================================

-- 1. Enable unaccent extension (for accent removal)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Add fingerprint column to articles table
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS title_fingerprint TEXT;

-- 3. Create normalization function for fingerprinting
CREATE OR REPLACE FUNCTION public.normalize_title_for_fingerprint(input_title TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result TEXT;
BEGIN
  -- 1. Convert to lowercase
  result := LOWER(input_title);
  
  -- 2. Remove accents
  result := unaccent(result);
  
  -- 3. Remove punctuation (keep only alphanumeric and spaces)
  result := regexp_replace(result, '[^\w\s]', '', 'g');
  
  -- 4. Remove common Portuguese stopwords
  result := regexp_replace(result, '\y(de|da|do|das|dos|e|ou|a|o|as|os|um|uma|uns|umas|para|por|com|em|no|na|nos|nas|ao|aos|a|as|pelo|pela|pelos|pelas|mais|menos|seu|sua|seus|suas|este|esta|estes|estas|esse|essa|esses|essas|aquele|aquela|aqueles|aquelas|que|qual|quais|como|quando|onde|porque|se|tambem|ja|ainda|muito|muita|muitos|muitas|sobre|entre|ate|desde|apos|sob|sem|ter|ter|sido|sido|foi|foi|era|sera|sera|pode|podem|deve|devem|fazer|faz|feito|forma|formas|ano|anos)\y', ' ', 'g');
  
  -- 5. Normalize spaces (collapse multiple spaces into one)
  result := regexp_replace(TRIM(result), '\s+', ' ', 'g');
  
  RETURN result;
END;
$$;

-- 4. Create trigger function to auto-set fingerprint
CREATE OR REPLACE FUNCTION public.set_article_fingerprint()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.title_fingerprint := normalize_title_for_fingerprint(NEW.title);
  RETURN NEW;
END;
$$;

-- 5. Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS trigger_set_article_fingerprint ON public.articles;
CREATE TRIGGER trigger_set_article_fingerprint
BEFORE INSERT OR UPDATE OF title ON public.articles
FOR EACH ROW
EXECUTE FUNCTION public.set_article_fingerprint();

-- 6. Backfill existing articles with fingerprints
UPDATE public.articles 
SET title_fingerprint = normalize_title_for_fingerprint(title)
WHERE title_fingerprint IS NULL;

-- 7. Create unique index (prevents duplicates at database level)
-- Using partial index to allow NULL fingerprints
CREATE UNIQUE INDEX IF NOT EXISTS uniq_article_fingerprint_per_blog
ON public.articles (blog_id, title_fingerprint)
WHERE title_fingerprint IS NOT NULL;