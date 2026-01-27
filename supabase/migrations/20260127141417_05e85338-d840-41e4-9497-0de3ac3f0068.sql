-- =============================================================
-- FASE 0.2: TRIGGER DE AUTO-MEMBERSHIP
-- Objetivo: Garantir que todo tenant tenha owner (defesa em profundidade)
-- =============================================================

-- =============================================
-- 1. FUNÇÃO SECURITY DEFINER
-- =============================================
CREATE OR REPLACE FUNCTION public.auto_create_tenant_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só cria se owner_user_id foi definido e membership não existe
  IF NEW.owner_user_id IS NOT NULL THEN
    INSERT INTO public.tenant_members (tenant_id, user_id, role)
    VALUES (NEW.id, NEW.owner_user_id, 'owner')
    ON CONFLICT (tenant_id, user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- =============================================
-- 2. TRIGGER AFTER INSERT
-- =============================================
DROP TRIGGER IF EXISTS auto_create_tenant_owner_trigger ON public.tenants;

CREATE TRIGGER auto_create_tenant_owner_trigger
AFTER INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_tenant_owner();

-- =============================================
-- COMENTÁRIO
-- =============================================
-- Este trigger é um fallback de segurança.
-- O fluxo principal continua sendo a Edge Function provision-tenant.
-- O trigger garante que:
--   1. Criações diretas via SQL também tenham owner
--   2. Nunca exista um tenant sem membership
--   3. É idempotente (ON CONFLICT DO NOTHING)
-- =============================================================