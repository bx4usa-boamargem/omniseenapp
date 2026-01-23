-- Fix blogs with incorrect platform_subdomain
UPDATE blogs
SET platform_subdomain = slug || '.app.omniseen.app'
WHERE platform_subdomain IS NULL 
   OR platform_subdomain = ''
   OR platform_subdomain = 'blog'
   OR platform_subdomain = 'blog.app.omniseen.app'
   OR (platform_subdomain NOT LIKE '%.app.omniseen.app' AND custom_domain IS NULL);

-- Also update tenant_domains to match
UPDATE tenant_domains td
SET domain = b.slug || '.app.omniseen.app'
FROM blogs b
WHERE td.blog_id = b.id
  AND td.domain_type = 'subdomain'
  AND (td.domain = 'blog.app.omniseen.app' OR td.domain NOT LIKE '%.app.omniseen.app');