-- Add new columns for Mini-Site Editor
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS show_search boolean DEFAULT true;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS header_cta_text text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS header_cta_url text;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS show_categories_footer boolean DEFAULT true;