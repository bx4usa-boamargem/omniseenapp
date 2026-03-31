-- Rate limiting buckets for public content-api (Edge Function uses service_role).
-- Window: 1 minute per client_key (typically derived from client IP).

CREATE TABLE IF NOT EXISTS public.content_api_rate_buckets (
  client_key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (client_key, window_start)
);

COMMENT ON TABLE public.content_api_rate_buckets IS 'Per-minute request counts for content-api abuse protection.';

ALTER TABLE public.content_api_rate_buckets ENABLE ROW LEVEL SECURITY;

-- No policies: anon/authenticated cannot access; service_role bypasses RLS.

CREATE OR REPLACE FUNCTION public.content_api_increment_rate(
  p_client_key text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w timestamptz := date_trunc('minute', now());
  new_count integer;
BEGIN
  IF p_client_key IS NULL OR length(trim(p_client_key)) < 1 THEN
    RAISE EXCEPTION 'invalid p_client_key';
  END IF;

  INSERT INTO public.content_api_rate_buckets (client_key, window_start, count)
  VALUES (p_client_key, w, 1)
  ON CONFLICT (client_key, window_start)
  DO UPDATE SET count = public.content_api_rate_buckets.count + 1
  RETURNING count INTO new_count;

  -- Opportunistic prune of old windows (cheap guard, not a full cleanup job)
  DELETE FROM public.content_api_rate_buckets
  WHERE window_start < now() - interval '2 hours';

  RETURN new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.content_api_increment_rate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.content_api_increment_rate(text) TO service_role;
