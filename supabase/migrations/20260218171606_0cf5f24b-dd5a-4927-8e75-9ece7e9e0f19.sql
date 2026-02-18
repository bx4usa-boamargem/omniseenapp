-- Drop and recreate elite_engine_analytics view with new local intelligence columns
-- First check dependent views
DROP VIEW IF EXISTS public.elite_engine_collision_rate;
DROP VIEW IF EXISTS public.elite_engine_angle_distribution;
DROP VIEW IF EXISTS public.elite_engine_structure_distribution;
DROP VIEW IF EXISTS public.elite_engine_analytics;

CREATE VIEW public.elite_engine_analytics AS
SELECT 
  a.id AS article_id,
  a.blog_id,
  COALESCE((a.source_payload->'eliteEngine'->>'city'), bp.city) AS city,
  COALESCE((a.source_payload->'eliteEngine'->>'niche_normalized'), bp.niche) AS niche,
  a.article_structure_type AS structure_type,
  (a.source_payload->'eliteEngine'->>'angle') AS angle,
  (a.source_payload->'eliteEngine'->>'style_mode') AS style_mode,
  (a.source_payload->'eliteEngine'->>'variant') AS variant,
  ARRAY(SELECT jsonb_array_elements_text(COALESCE(a.source_payload->'eliteEngine'->'blocks', '[]'::jsonb))) AS blocks_used,
  (a.source_payload->'eliteEngine'->>'structure_hash') AS structure_hash,
  (a.source_payload->'eliteEngine'->>'blocks_hash') AS blocks_hash,
  (a.source_payload->'eliteEngine'->>'h2_pattern_hash') AS h2_pattern_hash,
  ((a.source_payload->'eliteEngine'->>'similarity_score')::numeric) AS similarity_score,
  ((a.source_payload->'eliteEngine'->>'high_similarity_warning')::boolean) AS high_similarity_warning,
  ((a.source_payload->'eliteEngine'->'anti_collision'->>'collision_avoided')::boolean) AS collision_avoided,
  (a.source_payload->'eliteEngine'->'anti_collision'->>'scope') AS collision_scope,
  (a.source_payload->'eliteEngine'->>'rhythm_profile') AS rhythm_profile,
  (a.source_payload->'eliteEngine'->>'funnel_mode') AS funnel_mode,
  (a.source_payload->'eliteEngine'->>'article_goal') AS article_goal,
  (a.source_payload->'eliteEngine'->>'version') AS engine_version,
  a.created_at,
  -- V2.2: Local Intelligence columns
  (a.source_payload->'eliteEngine'->'local_intelligence'->>'city_size') AS city_size,
  (a.source_payload->'eliteEngine'->'local_intelligence'->>'density_strategy') AS density_strategy,
  (a.source_payload->'eliteEngine'->'local_intelligence'->>'geo_language_style') AS geo_language_style
FROM articles a
LEFT JOIN business_profile bp ON bp.blog_id = a.blog_id
WHERE (a.source_payload->'eliteEngine') IS NOT NULL;

-- Recreate dependent views
CREATE VIEW public.elite_engine_structure_distribution
WITH (security_invoker = true) AS
SELECT 
  blog_id,
  structure_type,
  COUNT(*) AS count,
  ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY blog_id), 0) * 100, 1) AS percentage
FROM public.elite_engine_analytics
GROUP BY blog_id, structure_type;

CREATE VIEW public.elite_engine_angle_distribution
WITH (security_invoker = true) AS
SELECT 
  blog_id,
  niche,
  angle,
  COUNT(*) AS count,
  ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY blog_id, niche), 0) * 100, 1) AS percentage
FROM public.elite_engine_analytics
GROUP BY blog_id, niche, angle;

CREATE VIEW public.elite_engine_collision_rate
WITH (security_invoker = true) AS
SELECT 
  blog_id,
  city,
  niche,
  COUNT(*) AS total_articles,
  SUM(CASE WHEN collision_avoided THEN 1 ELSE 0 END) AS collisions_avoided,
  ROUND(
    SUM(CASE WHEN collision_avoided THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1
  ) AS collision_rate
FROM public.elite_engine_analytics
GROUP BY blog_id, city, niche;