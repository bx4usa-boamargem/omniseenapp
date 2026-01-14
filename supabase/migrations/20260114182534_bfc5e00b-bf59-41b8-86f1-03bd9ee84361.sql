-- Create table for tracking link clicks and shares
CREATE TABLE public.link_click_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('link_copy', 'link_open', 'qr_download', 'qr_scan', 'external_access')),
  source TEXT,
  referrer TEXT,
  device TEXT,
  browser TEXT,
  country TEXT,
  session_id TEXT,
  visitor_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE link_click_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public tracking)
CREATE POLICY "Anyone can insert link events" ON link_click_events
  FOR INSERT WITH CHECK (true);

-- Blog owners can view their link events
CREATE POLICY "Blog owners can view their link events" ON link_click_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM blogs WHERE blogs.id = link_click_events.blog_id AND blogs.user_id = auth.uid())
  );

-- Team members can view their blog's link events
CREATE POLICY "Team members can view link events" ON link_click_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM team_members WHERE team_members.blog_id = link_click_events.blog_id AND team_members.user_id = auth.uid() AND team_members.status = 'accepted')
  );

-- Indexes for performance
CREATE INDEX idx_link_click_events_blog_id ON link_click_events(blog_id);
CREATE INDEX idx_link_click_events_created_at ON link_click_events(created_at);
CREATE INDEX idx_link_click_events_type ON link_click_events(event_type);