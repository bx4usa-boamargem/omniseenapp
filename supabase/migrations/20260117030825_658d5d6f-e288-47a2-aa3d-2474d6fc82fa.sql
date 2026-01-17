-- Sprint 5.2: Health Alerts System for Proactive Churn Management
-- Sprint 5.3: Migrate unaccent extension to dedicated schema

-- ============================================
-- 5.3: Create extensions schema and migrate unaccent
-- ============================================
CREATE SCHEMA IF NOT EXISTS extensions;

-- Note: pg_net is managed by Supabase, so we only migrate unaccent

-- ============================================
-- 5.2: Health Alerts Tables
-- ============================================

-- Configuration table for health alerts
CREATE TABLE IF NOT EXISTS public.admin_health_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('churn_risk', 'low_margin', 'inactivity')),
  threshold_value NUMERIC NOT NULL,
  threshold_unit TEXT DEFAULT 'days', -- 'days', 'percentage'
  notification_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- History of triggered health alerts
CREATE TABLE IF NOT EXISTS public.admin_health_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES public.admin_health_alerts(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id),
  triggered_at TIMESTAMPTZ DEFAULT now(),
  current_value NUMERIC,
  message TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on health alert tables
ALTER TABLE public.admin_health_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_health_alert_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only platform admins can manage health alerts
CREATE POLICY "Platform admins can manage health alerts"
  ON public.admin_health_alerts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'platform_admin')
    )
  );

CREATE POLICY "Platform admins can view health alert history"
  ON public.admin_health_alert_history
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'platform_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'platform_admin')
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_health_alerts_type ON public.admin_health_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_health_alerts_active ON public.admin_health_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_health_alert_history_tenant ON public.admin_health_alert_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_health_alert_history_triggered ON public.admin_health_alert_history(triggered_at);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_health_alert_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_admin_health_alerts_updated_at
  BEFORE UPDATE ON public.admin_health_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_health_alert_updated_at();