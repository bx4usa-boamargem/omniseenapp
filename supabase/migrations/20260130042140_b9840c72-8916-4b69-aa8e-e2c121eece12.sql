-- V4.1: Add images_pending column for async image generation
ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS images_pending BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN articles.images_pending IS 'True when images are being generated in background';