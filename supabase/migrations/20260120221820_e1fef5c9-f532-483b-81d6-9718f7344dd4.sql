-- Migração para corrigir dados legados de subdomínios
-- Atualiza de *.omniseen.app para *.app.omniseen.app

-- 1) Remover registros legados em tenant_domains onde o novo formato já existe
DELETE FROM public.tenant_domains td1
WHERE td1.domain_type = 'subdomain'
  AND td1.domain LIKE '%.omniseen.app'
  AND td1.domain NOT LIKE '%.app.omniseen.app'
  AND EXISTS (
    SELECT 1 FROM public.tenant_domains td2
    WHERE td2.tenant_id = td1.tenant_id
      AND td2.domain = regexp_replace(td1.domain, '\.omniseen\.app$', '.app.omniseen.app')
  );

-- 2) Atualizar registros legados restantes em tenant_domains para novo formato
UPDATE public.tenant_domains
SET domain = regexp_replace(domain, '\.omniseen\.app$', '.app.omniseen.app'),
    updated_at = now()
WHERE domain_type = 'subdomain'
  AND domain LIKE '%.omniseen.app'
  AND domain NOT LIKE '%.app.omniseen.app';

-- 3) Atualizar blogs.platform_subdomain para novo formato
UPDATE public.blogs
SET platform_subdomain = regexp_replace(platform_subdomain, '\.omniseen\.app$', '.app.omniseen.app'),
    updated_at = now()
WHERE platform_subdomain LIKE '%.omniseen.app'
  AND platform_subdomain NOT LIKE '%.app.omniseen.app';