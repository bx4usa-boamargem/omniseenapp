ALTER TABLE blogs ADD COLUMN IF NOT EXISTS hide_author boolean NOT NULL DEFAULT false;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS social_facebook text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS social_instagram text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS social_linkedin text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS social_twitter text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS social_youtube text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS social_tiktok text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS social_whatsapp text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS glossary_terms jsonb NOT NULL DEFAULT '[]'::jsonb;