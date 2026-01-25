-- Add OAuth columns to cms_integrations table for WordPress.com support
ALTER TABLE cms_integrations ADD COLUMN IF NOT EXISTS 
  auth_type TEXT DEFAULT 'api_key';

ALTER TABLE cms_integrations ADD COLUMN IF NOT EXISTS 
  access_token_encrypted BYTEA;

ALTER TABLE cms_integrations ADD COLUMN IF NOT EXISTS 
  refresh_token_encrypted BYTEA;

ALTER TABLE cms_integrations ADD COLUMN IF NOT EXISTS 
  token_expires_at TIMESTAMPTZ;

ALTER TABLE cms_integrations ADD COLUMN IF NOT EXISTS 
  wordpress_site_id TEXT;

-- Drop and recreate view with new columns
DROP VIEW IF EXISTS cms_integrations_decrypted;

CREATE VIEW cms_integrations_decrypted AS
SELECT 
  id, 
  blog_id, 
  platform, 
  site_url, 
  auth_type,
  wordpress_site_id,
  COALESCE(decrypt_credential(api_key_encrypted, blog_id), api_key) AS api_key,
  COALESCE(decrypt_credential(api_secret_encrypted, blog_id), api_secret) AS api_secret,
  decrypt_credential(access_token_encrypted, blog_id) AS access_token,
  decrypt_credential(refresh_token_encrypted, blog_id) AS refresh_token,
  token_expires_at,
  username, 
  is_active, 
  auto_publish, 
  last_sync_at, 
  last_sync_status, 
  created_at, 
  updated_at
FROM cms_integrations;

-- Grant access to authenticated users
GRANT SELECT ON cms_integrations_decrypted TO authenticated;