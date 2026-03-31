-- White-label settings for agency tenants
CREATE TABLE IF NOT EXISTS white_label_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  is_enabled boolean DEFAULT false,
  custom_brand_name text,
  custom_logo_url text,
  custom_favicon_url text,
  custom_primary_color text DEFAULT '#6366f1',
  custom_support_email text,
  hide_powered_by boolean DEFAULT false,
  custom_login_bg_url text,
  report_logo_url text,
  report_company_name text,
  wordpress_plugin_branding boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id)
);

ALTER TABLE white_label_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant owners can manage white-label"
  ON white_label_settings FOR ALL
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
