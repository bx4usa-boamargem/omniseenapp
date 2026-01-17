-- Sprint 4: Security Hardening

-- 4.1 Fix functions without immutable search_path
ALTER FUNCTION has_role(uuid, app_role) SET search_path = public;
ALTER FUNCTION is_team_member_of_blog(uuid, uuid) SET search_path = public;

-- 4.2 Restrict system tables to service_role only

-- ai_content_cache: should only be managed by backend services
DROP POLICY IF EXISTS "Service can manage cache" ON ai_content_cache;
CREATE POLICY "Service role manages cache" ON ai_content_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ai_usage_logs: system logs should not be publicly accessible  
DROP POLICY IF EXISTS "Service role can manage logs" ON ai_usage_logs;
CREATE POLICY "Service role manages logs" ON ai_usage_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- article_conversion_metrics: allow anon to INSERT (for tracking), but UPDATE/DELETE by service only
DROP POLICY IF EXISTS "System can insert conversion metrics" ON article_conversion_metrics;
DROP POLICY IF EXISTS "System can update conversion metrics" ON article_conversion_metrics;

CREATE POLICY "Anyone can insert conversion metrics" ON article_conversion_metrics
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role updates conversion metrics" ON article_conversion_metrics
  FOR UPDATE
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role deletes conversion metrics" ON article_conversion_metrics
  FOR DELETE
  USING (auth.role() = 'service_role');

-- blog_traffic: system table managed by backend
DROP POLICY IF EXISTS "System can insert traffic data" ON blog_traffic;
CREATE POLICY "Service role manages traffic" ON blog_traffic
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');