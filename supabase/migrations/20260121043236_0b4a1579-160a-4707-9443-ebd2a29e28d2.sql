-- =====================================================
-- FIX: Corrigir platform_subdomain e tenant_domains
-- =====================================================

-- 1. Corrigir blogs com platform_subdomain no formato antigo ou inválido
-- O formato correto é: {slug}.app.omniseen.app
UPDATE blogs
SET platform_subdomain = slug || '.app.omniseen.app'
WHERE slug IS NOT NULL 
  AND slug != ''
  AND (
    platform_subdomain IS NULL 
    OR platform_subdomain = ''
    OR platform_subdomain NOT LIKE '%.app.omniseen.app'
  );

-- 2. Garantir que cada blog com tenant_id tenha um tenant_domain de plataforma
-- Isso é necessário para a função resolve_domain funcionar corretamente
INSERT INTO tenant_domains (tenant_id, blog_id, domain, domain_type, status, is_primary)
SELECT 
  b.tenant_id,
  b.id as blog_id,
  b.platform_subdomain as domain,
  'subdomain' as domain_type,
  'active' as status,
  true as is_primary
FROM blogs b
WHERE b.platform_subdomain LIKE '%.app.omniseen.app'
  AND b.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM tenant_domains td 
    WHERE td.blog_id = b.id 
    AND td.domain_type = 'subdomain'
  )
ON CONFLICT DO NOTHING;

-- 3. Atualizar tenant_domains existentes que estão com status incorreto
UPDATE tenant_domains
SET status = 'active'
WHERE domain_type = 'subdomain'
  AND domain LIKE '%.app.omniseen.app'
  AND status != 'active';