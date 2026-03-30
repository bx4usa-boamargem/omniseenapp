
-- Fix content_blocks: restrict ALL access to service_role only, add read-only for authenticated
DROP POLICY IF EXISTS "Service role full access on content_blocks" ON public.content_blocks;
CREATE POLICY "Service role only on content_blocks"
  ON public.content_blocks FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can read content_blocks"
  ON public.content_blocks FOR SELECT
  TO authenticated
  USING (true);

-- Fix niche_profiles: restrict public SELECT to authenticated only
DROP POLICY IF EXISTS "Public can view niche profiles" ON public.niche_profiles;
DROP POLICY IF EXISTS "Anyone can view niche profiles" ON public.niche_profiles;
CREATE POLICY "Authenticated can view niche profiles"
  ON public.niche_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Fix model_pricing: restrict to authenticated
DROP POLICY IF EXISTS "Public can view model pricing" ON public.model_pricing;
DROP POLICY IF EXISTS "Anyone can view model pricing" ON public.model_pricing;
CREATE POLICY "Authenticated can view model pricing"
  ON public.model_pricing FOR SELECT
  TO authenticated
  USING (true);

-- Fix global_comm_config: restrict to authenticated
DROP POLICY IF EXISTS "Public can view global comm config" ON public.global_comm_config;
DROP POLICY IF EXISTS "Anyone can view global config" ON public.global_comm_config;
CREATE POLICY "Authenticated can view global comm config"
  ON public.global_comm_config FOR SELECT
  TO authenticated
  USING (true);

-- Fix prompt_type_config: restrict to authenticated
DROP POLICY IF EXISTS "Public can view prompt config" ON public.prompt_type_config;
DROP POLICY IF EXISTS "Anyone can view prompt type config" ON public.prompt_type_config;
CREATE POLICY "Authenticated can view prompt type config"
  ON public.prompt_type_config FOR SELECT
  TO authenticated
  USING (true);

-- Fix help_faqs: restrict UPDATE to service_role only
DROP POLICY IF EXISTS "Anyone can update helpful count" ON public.help_faqs;
DROP POLICY IF EXISTS "Authenticated users can update helpful count" ON public.help_faqs;
CREATE POLICY "Service role can update help faqs"
  ON public.help_faqs FOR UPDATE
  TO service_role
  USING (true) WITH CHECK (true);
