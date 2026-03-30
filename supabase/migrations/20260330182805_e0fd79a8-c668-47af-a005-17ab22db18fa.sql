
-- ============================================================
-- 2. FIX: elite_engine_analytics view + dependents - use security_invoker
-- ============================================================
DROP VIEW IF EXISTS public.elite_engine_structure_distribution;
DROP VIEW IF EXISTS public.elite_engine_angle_distribution;
DROP VIEW IF EXISTS public.elite_engine_collision_rate;
DROP VIEW IF EXISTS public.elite_engine_analytics;

CREATE VIEW public.elite_engine_analytics
WITH (security_invoker = true)
AS
SELECT a.id AS article_id,
    a.blog_id,
    COALESCE(((a.source_payload -> 'eliteEngine') ->> 'city'), bp.city) AS city,
    COALESCE(((a.source_payload -> 'eliteEngine') ->> 'niche_normalized'), bp.niche) AS niche,
    a.article_structure_type AS structure_type,
    ((a.source_payload -> 'eliteEngine') ->> 'angle') AS angle,
    ((a.source_payload -> 'eliteEngine') ->> 'style_mode') AS style_mode,
    ((a.source_payload -> 'eliteEngine') ->> 'variant') AS variant,
    ARRAY( SELECT jsonb_array_elements_text(COALESCE(((a.source_payload -> 'eliteEngine') -> 'blocks'), '[]'::jsonb))) AS blocks_used,
    ((a.source_payload -> 'eliteEngine') ->> 'structure_hash') AS structure_hash,
    ((a.source_payload -> 'eliteEngine') ->> 'blocks_hash') AS blocks_hash,
    ((a.source_payload -> 'eliteEngine') ->> 'h2_pattern_hash') AS h2_pattern_hash,
    (((a.source_payload -> 'eliteEngine') ->> 'similarity_score'))::numeric AS similarity_score,
    (((a.source_payload -> 'eliteEngine') ->> 'high_similarity_warning'))::boolean AS high_similarity_warning,
    ((((a.source_payload -> 'eliteEngine') -> 'anti_collision') ->> 'collision_avoided'))::boolean AS collision_avoided,
    (((a.source_payload -> 'eliteEngine') -> 'anti_collision') ->> 'scope') AS collision_scope,
    ((a.source_payload -> 'eliteEngine') ->> 'rhythm_profile') AS rhythm_profile,
    ((a.source_payload -> 'eliteEngine') ->> 'funnel_mode') AS funnel_mode,
    ((a.source_payload -> 'eliteEngine') ->> 'article_goal') AS article_goal,
    ((a.source_payload -> 'eliteEngine') ->> 'version') AS engine_version,
    a.created_at,
    (((a.source_payload -> 'eliteEngine') -> 'local_intelligence') ->> 'city_size') AS city_size,
    (((a.source_payload -> 'eliteEngine') -> 'local_intelligence') ->> 'density_strategy') AS density_strategy,
    (((a.source_payload -> 'eliteEngine') -> 'local_intelligence') ->> 'geo_language_style') AS geo_language_style
FROM (articles a LEFT JOIN business_profile bp ON ((bp.blog_id = a.blog_id)))
WHERE ((a.source_payload -> 'eliteEngine') IS NOT NULL);

-- Recreate dependent views with security_invoker
CREATE VIEW public.elite_engine_structure_distribution
WITH (security_invoker = true)
AS
SELECT blog_id,
    structure_type,
    count(*) AS count,
    round((((count(*))::numeric / NULLIF(sum(count(*)) OVER (PARTITION BY blog_id), (0)::numeric)) * (100)::numeric), 1) AS percentage
FROM elite_engine_analytics
GROUP BY blog_id, structure_type;

CREATE VIEW public.elite_engine_angle_distribution
WITH (security_invoker = true)
AS
SELECT blog_id,
    niche,
    angle,
    count(*) AS count,
    round((((count(*))::numeric / NULLIF(sum(count(*)) OVER (PARTITION BY blog_id, niche), (0)::numeric)) * (100)::numeric), 1) AS percentage
FROM elite_engine_analytics
GROUP BY blog_id, niche, angle;

CREATE VIEW public.elite_engine_collision_rate
WITH (security_invoker = true)
AS
SELECT blog_id,
    city,
    niche,
    count(*) AS total_articles,
    sum(CASE WHEN collision_avoided THEN 1 ELSE 0 END) AS collisions_avoided,
    round((((sum(CASE WHEN collision_avoided THEN 1 ELSE 0 END))::numeric / (NULLIF(count(*), 0))::numeric) * (100)::numeric), 1) AS collision_rate
FROM elite_engine_analytics
GROUP BY blog_id, city, niche;

-- ============================================================
-- 3. FIX: client_reviews - remove flawed share_token SELECT policy
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view reviews by share token" ON public.client_reviews;

-- ============================================================
-- 4. FIX: niche_profiles - restrict INSERT/UPDATE to admins
-- ============================================================
DROP POLICY IF EXISTS "Only authenticated users can insert niche profiles" ON public.niche_profiles;
DROP POLICY IF EXISTS "Only authenticated users can update niche profiles" ON public.niche_profiles;

CREATE POLICY "Admins can insert niche profiles" ON public.niche_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'platform_admin')
  );

CREATE POLICY "Admins can update niche profiles" ON public.niche_profiles
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'platform_admin')
  );

-- ============================================================
-- 5. FIX: tenant_domains - restrict SELECT to active only
-- ============================================================
DROP POLICY IF EXISTS "Anyone can resolve domains" ON public.tenant_domains;

CREATE POLICY "Public can resolve active domains" ON public.tenant_domains
  FOR SELECT TO public
  USING (status = 'active');

-- ============================================================
-- 6. FIX: blog_traffic - restrict INSERT/UPDATE
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert traffic" ON public.blog_traffic;
DROP POLICY IF EXISTS "Anyone can update traffic" ON public.blog_traffic;

CREATE POLICY "Blog owners can insert traffic" ON public.blog_traffic
  FOR INSERT TO authenticated
  WITH CHECK (
    blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid())
  );

CREATE POLICY "Blog owners can update traffic" ON public.blog_traffic
  FOR UPDATE TO authenticated
  USING (
    blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid())
  );

-- ============================================================
-- 7. FIX: article_conversion_metrics - restrict INSERT
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert conversion metrics" ON public.article_conversion_metrics;

CREATE POLICY "Owners can insert conversion metrics" ON public.article_conversion_metrics
  FOR INSERT TO authenticated
  WITH CHECK (
    blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid())
  );

-- ============================================================
-- 8. FIX: team_activity_log - restrict INSERT
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert activity" ON public.team_activity_log;

CREATE POLICY "Team members can insert activity" ON public.team_activity_log
  FOR INSERT TO authenticated
  WITH CHECK (
    blog_id IN (SELECT id FROM blogs WHERE user_id = auth.uid())
    OR public.is_team_member_of_blog(blog_id)
  );

-- ============================================================
-- 9. FIX: Storage - user-library ownership checks
-- ============================================================
DROP POLICY IF EXISTS "Users can delete their library files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their library files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their library" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their library files" ON storage.objects;

CREATE POLICY "Users can view own library files" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'user-library' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can upload to own library" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-library' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own library files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'user-library' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own library files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'user-library' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 10. FIX: Storage - article-pdfs ownership checks
-- ============================================================
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem deletar PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Usuários autenticados podem fazer upload de PDFs" ON storage.objects;

CREATE POLICY "Auth users upload own article PDFs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'article-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Auth users update own article PDFs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'article-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Auth users delete own article PDFs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'article-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 11. FIX: Storage - ebook-pdfs ownership checks
-- ============================================================
DROP POLICY IF EXISTS "Users can delete their ebook pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their ebook pdfs" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload ebook pdfs" ON storage.objects;

CREATE POLICY "Auth users upload own ebook PDFs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ebook-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Auth users update own ebook PDFs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'ebook-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Auth users delete own ebook PDFs" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ebook-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);
