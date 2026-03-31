ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS generation_mode text DEFAULT 'premium' CHECK (generation_mode IN ('economic', 'premium'));
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS research_mode text DEFAULT 'google_grounding';
ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS rewrite_model text DEFAULT 'gpt-4.1';
