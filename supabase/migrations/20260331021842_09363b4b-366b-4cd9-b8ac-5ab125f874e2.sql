-- Recreate the view for service_role usage in edge functions only.
-- Edge functions use service_role key which bypasses RLS, so the view itself
-- is safe as long as the underlying table (cms_integrations) has proper RLS
-- (which it does - only blog owners can access their integrations).
CREATE OR REPLACE VIEW public.cms_integrations_decrypted AS
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

-- Revoke access from anon and authenticated roles - only service_role can use it
REVOKE ALL ON public.cms_integrations_decrypted FROM anon;
REVOKE ALL ON public.cms_integrations_decrypted FROM authenticated;