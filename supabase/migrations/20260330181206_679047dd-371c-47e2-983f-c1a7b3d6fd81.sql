
-- Fix content_blocks: drop the old public-facing policy and ensure correct ones exist
DROP POLICY IF EXISTS "Service role full access on content_blocks" ON public.content_blocks;
DROP POLICY IF EXISTS "Service role only on content_blocks" ON public.content_blocks;
DROP POLICY IF EXISTS "Authenticated users can read content_blocks" ON public.content_blocks;

CREATE POLICY "Service role only on content_blocks"
  ON public.content_blocks FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can read content_blocks"
  ON public.content_blocks FOR SELECT
  TO authenticated
  USING (true);

-- Encrypt GSC tokens: add encrypted columns
ALTER TABLE public.gsc_connections
  ADD COLUMN IF NOT EXISTS access_token_encrypted bytea,
  ADD COLUMN IF NOT EXISTS refresh_token_encrypted bytea;
