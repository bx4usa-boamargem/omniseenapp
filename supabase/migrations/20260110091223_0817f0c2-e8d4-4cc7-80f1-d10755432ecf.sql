-- Add article_goal column to article_queue table for Universal Prompt Type support
ALTER TABLE public.article_queue 
ADD COLUMN IF NOT EXISTS article_goal text;