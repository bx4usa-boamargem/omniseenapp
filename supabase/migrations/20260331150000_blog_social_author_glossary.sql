-- Migration: Blog social networks, author privacy, and glossary support
-- Adds: hide_author, social media links, and glossary_terms to blogs table

-- 1. Author privacy toggle
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS hide_author boolean NOT NULL DEFAULT false;

-- 2. Social media profile links (used to conditionally show share buttons)
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS social_facebook  text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS social_instagram text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS social_linkedin  text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS social_twitter   text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS social_youtube   text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS social_tiktok    text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS social_whatsapp  text;

-- 3. Glossary terms (JSON array: [{term, definition, url?}])
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS glossary_terms jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 4. Add comments for documentation
COMMENT ON COLUMN blogs.hide_author      IS 'If true, author box is hidden on public article pages';
COMMENT ON COLUMN blogs.social_facebook  IS 'Facebook page URL (used to show Facebook share button)';
COMMENT ON COLUMN blogs.social_instagram IS 'Instagram profile URL';
COMMENT ON COLUMN blogs.social_linkedin  IS 'LinkedIn page URL (used to show LinkedIn share button)';
COMMENT ON COLUMN blogs.social_twitter   IS 'Twitter/X profile URL (used to show X share button)';
COMMENT ON COLUMN blogs.social_youtube   IS 'YouTube channel URL';
COMMENT ON COLUMN blogs.social_tiktok    IS 'TikTok profile URL';
COMMENT ON COLUMN blogs.social_whatsapp  IS 'WhatsApp number or wa.me link (used to show WhatsApp share button)';
COMMENT ON COLUMN blogs.glossary_terms   IS 'Array of glossary terms [{term, definition, url?}] for inline linking in articles';
