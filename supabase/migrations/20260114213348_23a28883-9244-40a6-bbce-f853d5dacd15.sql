-- Brand Sales Agent Tables for exclusive AI sales agents per sub-account

-- 1. Agent configuration per blog
CREATE TABLE public.brand_agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
  is_enabled BOOLEAN DEFAULT false,
  agent_name TEXT DEFAULT 'Consultor',
  agent_avatar_url TEXT,
  welcome_message TEXT DEFAULT 'Olá! Como posso ajudar você hoje?',
  personality_traits TEXT[],
  conversion_goals TEXT[] DEFAULT ARRAY['lead'],
  max_tokens_per_day INTEGER DEFAULT 50000,
  tokens_used_today INTEGER DEFAULT 0,
  tokens_reset_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  webhook_url TEXT,
  webhook_secret TEXT,
  proactive_delay_seconds INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(blog_id)
);

-- 2. Conversation history per visitor
CREATE TABLE public.brand_agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  messages JSONB DEFAULT '[]'::jsonb,
  lead_captured BOOLEAN DEFAULT false,
  tokens_used INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for fast visitor lookup
CREATE INDEX idx_brand_agent_conversations_visitor 
ON public.brand_agent_conversations(blog_id, visitor_id, session_id);

CREATE INDEX idx_brand_agent_conversations_blog 
ON public.brand_agent_conversations(blog_id, created_at DESC);

-- 3. Captured leads
CREATE TABLE public.brand_agent_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.brand_agent_conversations(id) ON DELETE SET NULL,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  article_title TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  interest_summary TEXT,
  lead_score INTEGER DEFAULT 50 CHECK (lead_score >= 0 AND lead_score <= 100),
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  webhook_sent_at TIMESTAMP WITH TIME ZONE,
  webhook_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_brand_agent_leads_blog 
ON public.brand_agent_leads(blog_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.brand_agent_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_agent_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for brand_agent_config (blog owners can manage)
CREATE POLICY "Blog owners can view their agent config"
ON public.brand_agent_config FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.blogs 
    WHERE blogs.id = brand_agent_config.blog_id 
    AND blogs.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'platform_admin')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Blog owners can insert agent config"
ON public.brand_agent_config FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.blogs 
    WHERE blogs.id = brand_agent_config.blog_id 
    AND blogs.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'platform_admin')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Blog owners can update agent config"
ON public.brand_agent_config FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.blogs 
    WHERE blogs.id = brand_agent_config.blog_id 
    AND blogs.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'platform_admin')
  OR public.has_role(auth.uid(), 'admin')
);

-- RLS Policies for brand_agent_conversations 
-- Public can INSERT (visitor starting conversation)
CREATE POLICY "Anyone can start a conversation"
ON public.brand_agent_conversations FOR INSERT
WITH CHECK (true);

-- Blog owners can view conversations
CREATE POLICY "Blog owners can view conversations"
ON public.brand_agent_conversations FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.blogs 
    WHERE blogs.id = brand_agent_conversations.blog_id 
    AND blogs.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'platform_admin')
  OR public.has_role(auth.uid(), 'admin')
);

-- Service role can update (for the edge function)
CREATE POLICY "Service role can update conversations"
ON public.brand_agent_conversations FOR UPDATE
USING (true)
WITH CHECK (true);

-- RLS Policies for brand_agent_leads
CREATE POLICY "Anyone can insert leads"
ON public.brand_agent_leads FOR INSERT
WITH CHECK (true);

CREATE POLICY "Blog owners can view leads"
ON public.brand_agent_leads FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.blogs 
    WHERE blogs.id = brand_agent_leads.blog_id 
    AND blogs.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'platform_admin')
  OR public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Blog owners can delete leads"
ON public.brand_agent_leads FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.blogs 
    WHERE blogs.id = brand_agent_leads.blog_id 
    AND blogs.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'platform_admin')
  OR public.has_role(auth.uid(), 'admin')
);

-- Function to reset daily tokens (called by cron or on first interaction of the day)
CREATE OR REPLACE FUNCTION public.reset_brand_agent_daily_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.brand_agent_config
  SET 
    tokens_used_today = 0,
    tokens_reset_at = now()
  WHERE tokens_reset_at < CURRENT_DATE;
END;
$$;

-- Trigger to update updated_at on brand_agent_config
CREATE TRIGGER update_brand_agent_config_updated_at
BEFORE UPDATE ON public.brand_agent_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();