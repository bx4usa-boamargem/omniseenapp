-- 1. Replace cms_integrations_decrypted view with a SECURITY DEFINER function
-- that only returns credentials for blogs owned by the calling user.
DROP VIEW IF EXISTS public.cms_integrations_decrypted;

CREATE OR REPLACE FUNCTION public.get_cms_integrations_decrypted(p_blog_id uuid)
RETURNS TABLE (
  id uuid,
  blog_id uuid,
  platform text,
  site_url text,
  auth_type text,
  wordpress_site_id text,
  api_key text,
  api_secret text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  username text,
  is_active boolean,
  auto_publish boolean,
  last_sync_at timestamptz,
  last_sync_status text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM blogs b WHERE b.id = p_blog_id AND b.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ci.id,
    ci.blog_id,
    ci.platform,
    ci.site_url,
    ci.auth_type,
    ci.wordpress_site_id,
    COALESCE(decrypt_credential(ci.api_key_encrypted, ci.blog_id), ci.api_key) AS api_key,
    COALESCE(decrypt_credential(ci.api_secret_encrypted, ci.blog_id), ci.api_secret) AS api_secret,
    decrypt_credential(ci.access_token_encrypted, ci.blog_id) AS access_token,
    decrypt_credential(ci.refresh_token_encrypted, ci.blog_id) AS refresh_token,
    ci.token_expires_at,
    ci.username,
    ci.is_active,
    ci.auto_publish,
    ci.last_sync_at,
    ci.last_sync_status,
    ci.created_at,
    ci.updated_at
  FROM cms_integrations ci
  WHERE ci.blog_id = p_blog_id;
END;
$$;

-- 2. Fix team_invites: remove overly broad public SELECT policy
DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.team_invites;

-- 3. Fix article-images bucket: replace overly broad UPDATE/DELETE with ownership-based
DROP POLICY IF EXISTS "Users can delete their uploaded images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their uploaded images" ON storage.objects;

CREATE POLICY "Users can update own article images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'article-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own article images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'article-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);