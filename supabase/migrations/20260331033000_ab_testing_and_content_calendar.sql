-- A/B Testing for article titles and meta descriptions
CREATE TABLE IF NOT EXISTS ab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id uuid NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  test_type text NOT NULL CHECK (test_type IN ('title', 'meta_description', 'featured_image')),
  variant_a text NOT NULL,
  variant_b text NOT NULL,
  winner text, -- 'a' | 'b' | null
  impressions_a integer DEFAULT 0,
  impressions_b integer DEFAULT 0,
  clicks_a integer DEFAULT 0,
  clicks_b integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  is_active boolean DEFAULT true,
  auto_apply_winner boolean DEFAULT true,
  min_impressions integer DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own AB tests"
  ON ab_tests FOR ALL
  USING (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()))
  WITH CHECK (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()));

-- Content calendar entries
CREATE TABLE IF NOT EXISTS content_calendar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id uuid NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  scheduled_date date NOT NULL,
  scheduled_time time,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'generated', 'published', 'cancelled')),
  article_id uuid REFERENCES articles(id) ON DELETE SET NULL,
  category text,
  keywords text[],
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  assignee_user_id uuid,
  color text DEFAULT '#6366f1',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own calendar"
  ON content_calendar FOR ALL
  USING (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()))
  WITH CHECK (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()));

-- API keys for public API access
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL, -- first 8 chars for display
  scopes text[] NOT NULL DEFAULT '{read}',
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owners can manage API keys"
  ON api_keys FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_content_calendar_blog_date ON content_calendar(blog_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_ab_tests_article ON ab_tests(article_id, is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
