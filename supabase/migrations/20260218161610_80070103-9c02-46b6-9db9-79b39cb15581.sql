-- Elite Engine Analytics Views V2.1
-- Extracts editorial DNA from source_payload.eliteEngine

CREATE OR REPLACE VIEW public.elite_engine_analytics AS
SELECT
  a.id AS article_id,
  a.blog_id,
  COALESCE(
    a.source_payload->'eliteEngine'->>'city',
    bp.city
  ) AS city,
  COALESCE(
    a.source_payload->'eliteEngine'->>'niche_normalized',
    bp.niche
  ) AS niche,
  a.article_structure_type AS structure_type,
  (a.source_payload->'eliteEngine'->>'angle') AS angle,
  (a.source_payload->'eliteEngine'->>'style_mode') AS style_mode,
  (a.source_payload->'eliteEngine'->>'variant') AS variant,
  ARRAY(
    SELECT jsonb_array_elements_text(
      COALESCE(a.source_payload->'eliteEngine'->'blocks', '[]'::jsonb)
    )
  ) AS blocks_used,
  (a.source_payload->'eliteEngine'->>'structure_hash') AS structure_hash,
  (a.source_payload->'eliteEngine'->>'blocks_hash') AS blocks_hash,
  (a.source_payload->'eliteEngine'->>'h2_pattern_hash') AS h2_pattern_hash,
  (a.source_payload->'eliteEngine'->>'similarity_score')::numeric AS similarity_score,
  (a.source_payload->'eliteEngine'->>'high_similarity_warning')::boolean AS high_similarity_warning,
  (a.source_payload->'eliteEngine'->'anti_collision'->>'collision_avoided')::boolean AS collision_avoided,
  (a.source_payload->'eliteEngine'->'anti_collision'->>'scope') AS collision_scope,
  (a.source_payload->'eliteEngine'->>'rhythm_profile') AS rhythm_profile,
  (a.source_payload->'eliteEngine'->>'funnel_mode') AS funnel_mode,
  (a.source_payload->'eliteEngine'->>'article_goal') AS article_goal,
  (a.source_payload->'eliteEngine'->>'version') AS engine_version,
  a.created_at
FROM articles a
LEFT JOIN business_profile bp ON bp.blog_id = a.blog_id
WHERE a.source_payload->'eliteEngine' IS NOT NULL;

-- Structure distribution per blog
CREATE OR REPLACE VIEW public.elite_engine_structure_distribution AS
SELECT blog_id, structure_type, COUNT(*) as count,
  ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY blog_id), 0) * 100, 1) AS percentage
FROM elite_engine_analytics
GROUP BY blog_id, structure_type;

-- Angle distribution per niche
CREATE OR REPLACE VIEW public.elite_engine_angle_distribution AS
SELECT niche, angle, COUNT(*) as count,
  ROUND(COUNT(*)::numeric / NULLIF(SUM(COUNT(*)) OVER (PARTITION BY niche), 0) * 100, 1) AS percentage
FROM elite_engine_analytics
GROUP BY niche, angle;

-- Collision rate per blog
CREATE OR REPLACE VIEW public.elite_engine_collision_rate AS
SELECT blog_id,
  COUNT(*) as total_articles,
  COUNT(*) FILTER (WHERE collision_avoided) as collisions_avoided,
  COUNT(*) FILTER (WHERE high_similarity_warning) as high_similarity_warnings,
  ROUND(AVG(COALESCE(similarity_score, 0)), 2) as avg_similarity,
  MAX(similarity_score) as max_similarity
FROM elite_engine_analytics
GROUP BY blog_id;