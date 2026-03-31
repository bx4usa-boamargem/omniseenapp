-- Daily aggregates for pipeline observability (join generation_steps → generation_jobs).

CREATE OR REPLACE VIEW public.generation_step_metrics_daily AS
SELECT
  (date_trunc('day', gs.completed_at AT TIME ZONE 'UTC'))::date AS day,
  gs.step_name,
  gj.job_type,
  gj.blog_id,
  count(*)::bigint AS step_count,
  sum(CASE WHEN gs.error_message IS NOT NULL AND gs.error_message <> '' THEN 1 ELSE 0 END)::bigint AS error_count,
  avg(gs.latency_ms)::numeric AS avg_latency_ms,
  sum(COALESCE(gs.cost_usd, 0::numeric))::numeric AS total_cost_usd,
  sum(COALESCE(gs.tokens_in, 0))::bigint AS total_tokens_in,
  sum(COALESCE(gs.tokens_out, 0))::bigint AS total_tokens_out
FROM public.generation_steps gs
INNER JOIN public.generation_jobs gj ON gj.id = gs.job_id
WHERE gs.completed_at IS NOT NULL
GROUP BY 1, 2, 3, 4;

COMMENT ON VIEW public.generation_step_metrics_daily IS
  'Daily aggregates per step_name, job_type, blog_id for dashboards and cost alerts.';

REVOKE ALL ON public.generation_step_metrics_daily FROM PUBLIC;
GRANT SELECT ON public.generation_step_metrics_daily TO service_role;
