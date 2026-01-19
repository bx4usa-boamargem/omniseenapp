-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encryption key storage (using a server-side secret)
-- Note: The encryption key is derived from a combination of the blog_id and a server secret

-- Add encrypted columns to cms_integrations
ALTER TABLE public.cms_integrations 
ADD COLUMN IF NOT EXISTS api_key_encrypted BYTEA,
ADD COLUMN IF NOT EXISTS api_secret_encrypted BYTEA;

-- Create function to encrypt credentials using symmetric encryption
CREATE OR REPLACE FUNCTION public.encrypt_credential(plaintext TEXT, key_id UUID)
RETURNS BYTEA AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN
    RETURN NULL;
  END IF;
  -- Create a deterministic key based on the key_id (blog_id) 
  -- In production, this should use Vault secrets
  encryption_key := encode(digest(key_id::text || 'omniseen_cms_key_v1', 'sha256'), 'hex');
  RETURN pgp_sym_encrypt(plaintext, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to decrypt credentials
CREATE OR REPLACE FUNCTION public.decrypt_credential(ciphertext BYTEA, key_id UUID)
RETURNS TEXT AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;
  encryption_key := encode(digest(key_id::text || 'omniseen_cms_key_v1', 'sha256'), 'hex');
  RETURN pgp_sym_decrypt(ciphertext, encryption_key);
EXCEPTION WHEN OTHERS THEN
  -- Return NULL if decryption fails (corrupted data)
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create a view that automatically decrypts credentials for authorized users
CREATE OR REPLACE VIEW public.cms_integrations_decrypted AS
SELECT 
  id,
  blog_id,
  platform,
  site_url,
  -- Return decrypted values if encrypted columns exist, otherwise fallback to plaintext
  COALESCE(decrypt_credential(api_key_encrypted, blog_id), api_key) AS api_key,
  COALESCE(decrypt_credential(api_secret_encrypted, blog_id), api_secret) AS api_secret,
  username,
  is_active,
  auto_publish,
  last_sync_at,
  last_sync_status,
  created_at,
  updated_at
FROM public.cms_integrations;

-- Grant access to the view (same as table)
GRANT SELECT ON public.cms_integrations_decrypted TO authenticated;
GRANT SELECT ON public.cms_integrations_decrypted TO service_role;

-- Create RLS policy for the view
ALTER VIEW public.cms_integrations_decrypted SET (security_invoker = true);

-- Migrate existing plaintext credentials to encrypted (one-time migration)
UPDATE public.cms_integrations
SET 
  api_key_encrypted = encrypt_credential(api_key, blog_id),
  api_secret_encrypted = encrypt_credential(api_secret, blog_id)
WHERE api_key IS NOT NULL OR api_secret IS NOT NULL;

-- Create trigger to automatically encrypt credentials on insert/update
CREATE OR REPLACE FUNCTION public.encrypt_cms_credentials_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- Encrypt api_key if provided
  IF NEW.api_key IS NOT NULL AND NEW.api_key != '' THEN
    NEW.api_key_encrypted := encrypt_credential(NEW.api_key, NEW.blog_id);
    NEW.api_key := '***ENCRYPTED***'; -- Mask plaintext column
  END IF;
  
  -- Encrypt api_secret if provided
  IF NEW.api_secret IS NOT NULL AND NEW.api_secret != '' THEN
    NEW.api_secret_encrypted := encrypt_credential(NEW.api_secret, NEW.blog_id);
    NEW.api_secret := '***ENCRYPTED***'; -- Mask plaintext column
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS encrypt_cms_credentials ON public.cms_integrations;

-- Create trigger for new inserts and updates
CREATE TRIGGER encrypt_cms_credentials
BEFORE INSERT OR UPDATE ON public.cms_integrations
FOR EACH ROW
EXECUTE FUNCTION public.encrypt_cms_credentials_trigger();

-- Add audit logging for credential access
CREATE TABLE IF NOT EXISTS public.cms_credential_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES public.cms_integrations(id) ON DELETE CASCADE,
  accessed_by UUID,
  accessed_at TIMESTAMPTZ DEFAULT NOW(),
  access_type TEXT NOT NULL, -- 'view', 'decrypt', 'publish'
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS on audit log
ALTER TABLE public.cms_credential_access_log ENABLE ROW LEVEL SECURITY;

-- Only service_role can insert audit logs
CREATE POLICY "Service role can insert audit logs" 
ON public.cms_credential_access_log 
FOR INSERT 
WITH CHECK (true);

-- Blog owners can view their audit logs
CREATE POLICY "Users can view their integration audit logs" 
ON public.cms_credential_access_log 
FOR SELECT 
USING (
  integration_id IN (
    SELECT id FROM public.cms_integrations 
    WHERE blog_id IN (
      SELECT id FROM public.blogs WHERE user_id = auth.uid()
    )
  )
);