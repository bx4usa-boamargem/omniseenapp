CREATE TABLE IF NOT EXISTS rate_limit_entries (
  id bigserial PRIMARY KEY,
  ip_address text NOT NULL,
  endpoint text NOT NULL DEFAULT 'content-api',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_ip_time ON rate_limit_entries (ip_address, created_at);

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_ip text,
  p_endpoint text DEFAULT 'content-api',
  p_window_seconds int DEFAULT 60,
  p_max_requests int DEFAULT 120
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_count int;
BEGIN
  DELETE FROM rate_limit_entries
  WHERE created_at < now() - (p_window_seconds || ' seconds')::interval;

  SELECT count(*) INTO request_count
  FROM rate_limit_entries
  WHERE ip_address = p_ip
    AND endpoint = p_endpoint
    AND created_at > now() - (p_window_seconds || ' seconds')::interval;

  IF request_count >= p_max_requests THEN
    RETURN false;
  END IF;

  INSERT INTO rate_limit_entries (ip_address, endpoint)
  VALUES (p_ip, p_endpoint);

  RETURN true;
END;
$$;
