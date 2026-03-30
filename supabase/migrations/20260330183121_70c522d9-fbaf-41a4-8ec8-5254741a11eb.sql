
-- ============================================================
-- 1. FIX: brand_agent_leads - validate blog_id on INSERT
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.brand_agent_leads;

CREATE POLICY "Public can insert leads for valid blogs" ON public.brand_agent_leads
  FOR INSERT TO public
  WITH CHECK (
    EXISTS (SELECT 1 FROM blogs WHERE id = blog_id AND is_active = true)
  );

-- ============================================================
-- 2. FIX: ebook_leads - validate ebook_id on INSERT
-- ============================================================
DROP POLICY IF EXISTS "Anyone can submit lead" ON public.ebook_leads;

CREATE POLICY "Public can submit leads for valid blogs" ON public.ebook_leads
  FOR INSERT TO public
  WITH CHECK (
    EXISTS (SELECT 1 FROM blogs WHERE id = blog_id AND is_active = true)
  );

-- ============================================================
-- 3. FIX: blog_feature_flags - add SELECT for blog owners
-- ============================================================
CREATE POLICY "Blog owners can view feature flags" ON public.blog_feature_flags
  FOR SELECT TO authenticated
  USING (
    blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid())
    OR public.is_team_member_of_blog(blog_id)
  );

-- ============================================================
-- 4. FIX: gsc_connections - drop plaintext token columns
--    (encrypted columns already exist and edge functions use them)
-- ============================================================
ALTER TABLE public.gsc_connections 
  DROP COLUMN IF EXISTS access_token,
  DROP COLUMN IF EXISTS refresh_token;

-- ============================================================
-- 5. FIX: cms_integrations RLS - ensure view inherits properly
--    Add explicit SELECT policy for blog owners on cms_integrations
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'cms_integrations' AND policyname = 'Blog owners can view their integrations'
  ) THEN
    EXECUTE 'CREATE POLICY "Blog owners can view their integrations" ON public.cms_integrations
      FOR SELECT TO authenticated
      USING (blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid()))';
  END IF;
END $$;
