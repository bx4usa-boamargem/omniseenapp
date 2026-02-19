-- PASSO 1: Add engine_version column to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS engine_version TEXT DEFAULT NULL;