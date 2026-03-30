
-- Create helper function for GSC token encryption using blog_id as key
CREATE OR REPLACE FUNCTION public.encrypt_gsc_token(plaintext text, p_blog_id uuid)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN
    RETURN NULL;
  END IF;
  RETURN extensions.pgp_sym_encrypt(plaintext, encode(extensions.digest(p_blog_id::text || 'omniseen_gsc_key_v1', 'sha256'), 'hex'));
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_gsc_token(ciphertext bytea, p_blog_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF ciphertext IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN extensions.pgp_sym_decrypt(ciphertext, encode(extensions.digest(p_blog_id::text || 'omniseen_gsc_key_v1', 'sha256'), 'hex'));
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
