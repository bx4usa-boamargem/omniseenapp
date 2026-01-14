-- Create territories table for hierarchical geographic targeting
CREATE TABLE public.territories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  state TEXT,
  city TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blog_id, country, state, city)
);

-- Create indexes for performance
CREATE INDEX idx_territories_blog_id ON public.territories(blog_id);
CREATE INDEX idx_territories_active ON public.territories(blog_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.territories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own territories"
  ON public.territories
  FOR SELECT
  USING (
    blog_id IN (SELECT id FROM public.blogs WHERE user_id = auth.uid())
    OR is_team_member_of_blog(blog_id, auth.uid())
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "Users can insert their own territories"
  ON public.territories
  FOR INSERT
  WITH CHECK (
    blog_id IN (SELECT id FROM public.blogs WHERE user_id = auth.uid())
    OR is_team_member_of_blog(blog_id, auth.uid())
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "Users can update their own territories"
  ON public.territories
  FOR UPDATE
  USING (
    blog_id IN (SELECT id FROM public.blogs WHERE user_id = auth.uid())
    OR is_team_member_of_blog(blog_id, auth.uid())
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "Users can delete their own territories"
  ON public.territories
  FOR DELETE
  USING (
    blog_id IN (SELECT id FROM public.blogs WHERE user_id = auth.uid())
    OR is_team_member_of_blog(blog_id, auth.uid())
    OR has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'platform_admin')
  );

-- Migrate existing city data from business_profile to territories
INSERT INTO public.territories (blog_id, country, city, is_active)
SELECT 
  bp.blog_id,
  COALESCE(bp.country, 'Brasil') as country,
  bp.city,
  true
FROM public.business_profile bp
WHERE bp.city IS NOT NULL AND bp.city != ''
ON CONFLICT DO NOTHING;

-- Add territory_id column to articles for tracking origin
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS territory_id UUID REFERENCES public.territories(id);

-- Add territories_count to usage_tracking
ALTER TABLE public.usage_tracking ADD COLUMN IF NOT EXISTS territories_count INTEGER DEFAULT 0;
ALTER TABLE public.usage_tracking ADD COLUMN IF NOT EXISTS radar_searches_used INTEGER DEFAULT 0;