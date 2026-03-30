-- Unblock publish by aligning the analytics view metadata with Live without recreating dependent views
-- This avoids the failing drop/recreate diff on publish for elite_engine_analytics.
ALTER VIEW public.elite_engine_analytics RESET (security_invoker);