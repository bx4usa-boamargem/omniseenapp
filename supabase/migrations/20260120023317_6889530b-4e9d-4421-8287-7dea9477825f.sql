-- ====================================
-- SPRINT 1: DOMAIN RESOLVER SOBERANO
-- ====================================

-- ====================================
-- FASE 1: CRIAR TABELA tenant_domains
-- ====================================

CREATE TABLE IF NOT EXISTS public.tenant_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  blog_id UUID REFERENCES public.blogs(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  domain_type TEXT NOT NULL DEFAULT 'subdomain',
  is_primary BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'pending',
  verification_token TEXT,
  dns_status JSONB DEFAULT '{}',
  error_message TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraints
  CONSTRAINT tenant_domains_unique_domain UNIQUE(domain),
  CONSTRAINT tenant_domains_valid_status CHECK (status IN ('pending', 'active', 'error', 'suspended')),
  CONSTRAINT tenant_domains_valid_type CHECK (domain_type IN ('subdomain', 'custom'))
);

-- Index para resolução rápida por hostname (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_domains_lower_domain 
  ON public.tenant_domains(lower(domain));

-- Indexes para consultas por tenant/blog
CREATE INDEX IF NOT EXISTS idx_tenant_domains_tenant_id 
  ON public.tenant_domains(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_domains_blog_id 
  ON public.tenant_domains(blog_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_tenant_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tenant_domains_updated_at ON public.tenant_domains;
CREATE TRIGGER trigger_tenant_domains_updated_at
  BEFORE UPDATE ON public.tenant_domains
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tenant_domains_updated_at();

-- ====================================
-- FASE 2: MIGRAR DADOS EXISTENTES
-- ====================================

-- Inserir subdomínios de plataforma (*.omniseen.app)
INSERT INTO public.tenant_domains (blog_id, tenant_id, domain, domain_type, is_primary, status)
SELECT 
  b.id as blog_id,
  b.tenant_id,
  COALESCE(b.platform_subdomain, b.slug) || '.omniseen.app' as domain,
  'subdomain' as domain_type,
  true as is_primary,
  'active' as status
FROM public.blogs b
WHERE (b.platform_subdomain IS NOT NULL AND b.platform_subdomain != '')
   OR (b.slug IS NOT NULL AND b.slug != '')
ON CONFLICT (domain) DO NOTHING;

-- Inserir domínios customizados (se existirem)
INSERT INTO public.tenant_domains (blog_id, tenant_id, domain, domain_type, is_primary, status, verification_token)
SELECT 
  b.id as blog_id,
  b.tenant_id,
  b.custom_domain,
  'custom' as domain_type,
  false as is_primary,
  CASE WHEN b.domain_verified = true THEN 'active' ELSE 'pending' END as status,
  b.domain_verification_token
FROM public.blogs b
WHERE b.custom_domain IS NOT NULL AND b.custom_domain != ''
ON CONFLICT (domain) DO NOTHING;

-- ====================================
-- FASE 3: CRIAR FUNÇÃO RPC SECURITY DEFINER
-- ====================================

CREATE OR REPLACE FUNCTION public.resolve_domain(p_hostname TEXT)
RETURNS TABLE (
  blog_id UUID,
  tenant_id UUID,
  domain TEXT,
  domain_type TEXT,
  status TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    td.blog_id,
    td.tenant_id,
    td.domain,
    td.domain_type,
    td.status
  FROM public.tenant_domains td
  WHERE lower(td.domain) = lower(p_hostname)
    AND td.status = 'active'
  LIMIT 1;
END;
$$;

-- ====================================
-- FASE 4: RLS POLICIES
-- ====================================

ALTER TABLE public.tenant_domains ENABLE ROW LEVEL SECURITY;

-- Service role tem acesso total (para edge functions e RPC)
CREATE POLICY "Service role has full access to tenant_domains"
  ON public.tenant_domains FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Permitir SELECT público para resolução de domínio (anon pode resolver)
CREATE POLICY "Anyone can resolve domains"
  ON public.tenant_domains FOR SELECT
  USING (true);

-- Blog owners podem inserir domínios para seus blogs
CREATE POLICY "Blog owners can insert their domains"
  ON public.tenant_domains FOR INSERT
  WITH CHECK (
    blog_id IN (SELECT id FROM public.blogs WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin'))
  );

-- Blog owners podem atualizar seus domínios
CREATE POLICY "Blog owners can update their domains"
  ON public.tenant_domains FOR UPDATE
  USING (
    blog_id IN (SELECT id FROM public.blogs WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin'))
  );

-- Blog owners podem deletar seus domínios
CREATE POLICY "Blog owners can delete their domains"
  ON public.tenant_domains FOR DELETE
  USING (
    blog_id IN (SELECT id FROM public.blogs WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'platform_admin'))
  );