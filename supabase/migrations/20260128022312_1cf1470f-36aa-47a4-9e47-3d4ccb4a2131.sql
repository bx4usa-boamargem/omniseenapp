-- Allow status = 'generating' for Early Redirect Pattern
-- Fixes SQLSTATE 23514 check_violation that blocks placeholder creation

-- Articles: Add 'generating' to allowed status values
ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_status_check;
ALTER TABLE public.articles ADD CONSTRAINT articles_status_check 
  CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'generating'::text]));

-- Landing Pages: Add 'generating' to allowed status values  
ALTER TABLE public.landing_pages DROP CONSTRAINT IF EXISTS landing_pages_status_check;
ALTER TABLE public.landing_pages ADD CONSTRAINT landing_pages_status_check 
  CHECK (status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text, 'generating'::text]));