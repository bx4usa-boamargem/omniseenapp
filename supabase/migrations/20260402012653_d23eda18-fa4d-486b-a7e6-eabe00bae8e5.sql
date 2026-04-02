ALTER TABLE public.generation_jobs
  ADD COLUMN IF NOT EXISTS research_failed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS research_failed_reason text;