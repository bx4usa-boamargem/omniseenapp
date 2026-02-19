
-- Add public status fields to generation_jobs for client-facing progress
-- These fields are maintained by the orchestrator and are the ONLY source of truth for subaccounts
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS public_stage TEXT;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS public_progress INTEGER DEFAULT 0;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS public_message TEXT;
ALTER TABLE public.generation_jobs ADD COLUMN IF NOT EXISTS public_updated_at TIMESTAMPTZ;
