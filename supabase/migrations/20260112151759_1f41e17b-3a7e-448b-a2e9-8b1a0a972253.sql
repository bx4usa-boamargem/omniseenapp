-- Add brand_display_mode column to blogs table
-- Values: 'text' (default) or 'image'
ALTER TABLE blogs 
ADD COLUMN IF NOT EXISTS brand_display_mode text DEFAULT 'text';

-- Add comment for documentation
COMMENT ON COLUMN blogs.brand_display_mode IS 'Brand display mode: text (show company name) or image (show logo)';