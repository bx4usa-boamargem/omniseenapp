-- Add territory_id column to market_intel_weekly for territorial intelligence
ALTER TABLE public.market_intel_weekly 
ADD COLUMN IF NOT EXISTS territory_id UUID REFERENCES public.territories(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_market_intel_weekly_territory 
ON public.market_intel_weekly(territory_id);

-- Create composite unique constraint (blog + week + territory)
-- This allows one intel per territory per week per blog
ALTER TABLE public.market_intel_weekly 
DROP CONSTRAINT IF EXISTS market_intel_weekly_blog_id_week_of_key;

-- Create new unique constraint including territory
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_intel_weekly_unique_territory 
ON public.market_intel_weekly(blog_id, week_of, COALESCE(territory_id, '00000000-0000-0000-0000-000000000000'::uuid));