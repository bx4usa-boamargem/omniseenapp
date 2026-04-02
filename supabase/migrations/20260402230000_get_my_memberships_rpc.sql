-- =============================================================
-- RPC: get_my_memberships
-- Retorna as memberships do user logado com dados do tenant
-- Usa SECURITY DEFINER para bypasear qualquer RLS recursivo
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_my_memberships()
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  user_id UUID,
  role TEXT,
  joined_at TIMESTAMPTZ,
  tenant_name TEXT,
  tenant_slug TEXT,
  tenant_owner_user_id UUID,
  tenant_plan TEXT,
  tenant_status TEXT,
  tenant_created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT 
    tm.id,
    tm.tenant_id,
    tm.user_id,
    tm.role,
    tm.joined_at,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    t.owner_user_id AS tenant_owner_user_id,
    t.plan AS tenant_plan,
    t.status AS tenant_status,
    t.created_at AS tenant_created_at
  FROM public.tenant_members tm
  JOIN public.tenants t ON t.id = tm.tenant_id
  WHERE tm.user_id = auth.uid();
$$;

-- Permissão para authenticated users chamarem
GRANT EXECUTE ON FUNCTION public.get_my_memberships() TO authenticated;
