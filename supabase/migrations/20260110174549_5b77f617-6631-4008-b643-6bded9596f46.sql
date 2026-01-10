-- Add funnel_mode column to article_queue table
ALTER TABLE public.article_queue 
ADD COLUMN IF NOT EXISTS funnel_mode TEXT;