-- Tabela de configuração por blog para SERP Score
CREATE TABLE IF NOT EXISTS public.blog_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID REFERENCES public.blogs(id) ON DELETE CASCADE UNIQUE,
  
  -- SERP Score Settings
  minimum_score_to_publish INTEGER DEFAULT 70 CHECK (minimum_score_to_publish BETWEEN 50 AND 95),
  serp_cache_ttl_hours INTEGER DEFAULT 24,
  auto_boost_on_publish BOOLEAN DEFAULT false,
  
  -- Quality Gate Settings
  min_word_count INTEGER DEFAULT 1200,
  max_word_count INTEGER DEFAULT 3000,
  require_featured_image BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.blog_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Blog owners can manage config"
ON public.blog_config
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.blogs 
    WHERE blogs.id = blog_config.blog_id 
    AND blogs.user_id = auth.uid()
  )
  OR
  public.is_team_member_of_blog(blog_config.blog_id)
);

-- Trigger para updated_at
CREATE TRIGGER update_blog_config_updated_at
  BEFORE UPDATE ON public.blog_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();