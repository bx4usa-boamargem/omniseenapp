ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS geo_score integer,
  ADD COLUMN IF NOT EXISTS geo_score_label text,
  ADD COLUMN IF NOT EXISTS geo_score_breakdown jsonb;