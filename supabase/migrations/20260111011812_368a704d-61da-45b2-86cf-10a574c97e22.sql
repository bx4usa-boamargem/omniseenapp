-- Create blog_contact_buttons table for Meu Mini-Site
CREATE TABLE public.blog_contact_buttons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
  button_type TEXT NOT NULL CHECK (button_type IN ('whatsapp', 'phone', 'instagram', 'website', 'link')),
  label TEXT,
  value TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_contact_buttons ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own blog buttons"
ON public.blog_contact_buttons FOR SELECT
USING (
  blog_id IN (SELECT id FROM public.blogs WHERE user_id = auth.uid())
  OR blog_id IN (
    SELECT blog_id FROM public.team_members 
    WHERE user_id = auth.uid() AND status = 'accepted'
  )
);

CREATE POLICY "Users can insert their own blog buttons"
ON public.blog_contact_buttons FOR INSERT
WITH CHECK (
  blog_id IN (SELECT id FROM public.blogs WHERE user_id = auth.uid())
  OR blog_id IN (
    SELECT blog_id FROM public.team_members 
    WHERE user_id = auth.uid() AND status = 'accepted'
  )
);

CREATE POLICY "Users can update their own blog buttons"
ON public.blog_contact_buttons FOR UPDATE
USING (
  blog_id IN (SELECT id FROM public.blogs WHERE user_id = auth.uid())
  OR blog_id IN (
    SELECT blog_id FROM public.team_members 
    WHERE user_id = auth.uid() AND status = 'accepted'
  )
);

CREATE POLICY "Users can delete their own blog buttons"
ON public.blog_contact_buttons FOR DELETE
USING (
  blog_id IN (SELECT id FROM public.blogs WHERE user_id = auth.uid())
  OR blog_id IN (
    SELECT blog_id FROM public.team_members 
    WHERE user_id = auth.uid() AND status = 'accepted'
  )
);

-- Public can view buttons for public blogs
CREATE POLICY "Public can view blog buttons"
ON public.blog_contact_buttons FOR SELECT
USING (true);

-- Create index for performance
CREATE INDEX idx_blog_contact_buttons_blog_id ON public.blog_contact_buttons(blog_id);