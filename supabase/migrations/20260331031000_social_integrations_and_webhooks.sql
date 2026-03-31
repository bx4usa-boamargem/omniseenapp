-- Social integrations for LinkedIn and Instagram posting
CREATE TABLE IF NOT EXISTS social_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id uuid NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('linkedin', 'instagram')),
  access_token text,
  refresh_token text,
  platform_user_id text,
  platform_page_id text,
  token_expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (blog_id, platform)
);

ALTER TABLE social_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own social integrations"
  ON social_integrations FOR ALL
  USING (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()))
  WITH CHECK (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()));

-- Social publish logs
CREATE TABLE IF NOT EXISTS social_publish_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id uuid NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  article_id uuid REFERENCES articles(id) ON DELETE SET NULL,
  platform text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  post_url text,
  error_message text,
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE social_publish_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own social logs"
  ON social_publish_logs FOR SELECT
  USING (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()));

-- Webhook endpoints
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id uuid NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text,
  events text[] NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  max_retries integer DEFAULT 3,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own webhook endpoints"
  ON webhook_endpoints FOR ALL
  USING (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()))
  WITH CHECK (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()));

-- Webhook delivery logs
CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_endpoint_id uuid REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  blog_id uuid NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  event text NOT NULL,
  payload text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  attempts integer DEFAULT 0,
  delivered_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own webhook logs"
  ON webhook_delivery_logs FOR SELECT
  USING (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()));
