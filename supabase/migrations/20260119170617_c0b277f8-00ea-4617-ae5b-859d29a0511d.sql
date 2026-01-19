-- Remover política antiga que só permite admin
DROP POLICY IF EXISTS "Admins can view all logs" ON ai_usage_logs;

-- Criar nova política que inclui platform_admin
CREATE POLICY "Platform admins and admins can view logs"
  ON ai_usage_logs FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'platform_admin'::app_role)
  );