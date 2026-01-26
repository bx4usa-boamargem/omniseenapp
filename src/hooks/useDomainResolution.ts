import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentHostname } from '@/utils/blogUrl';
import { extractSubdomainSlug, isCustomDomainHost, isSubaccountHost } from '@/utils/platformUrls';

interface DomainResolution {
  blogId: string | null;
  tenantId: string | null;
  domain: string | null;
  domainType: 'subdomain' | 'custom' | null;
  status: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para resolução de domínios via RPC resolve_domain
 * Fonte única de verdade para mapear hostname -> blog_id/tenant_id
 *
 * Fallbacks:
 * - subdomínio {slug}.app.omniseen.app: tenta resolver por blogs.platform_subdomain ou blogs.slug
 * - domínio customizado: tenta resolver por blogs.custom_domain
 */
export function useDomainResolution(): DomainResolution {
  const [state, setState] = useState<DomainResolution>({
    blogId: null,
    tenantId: null,
    domain: null,
    domainType: null,
    status: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const resolveDomain = async () => {
      const hostname = getCurrentHostname();

      if (!hostname) {
        setState((prev) => ({ ...prev, isLoading: false, error: 'No hostname' }));
        return;
      }

      console.log('[useDomainResolution] Resolving hostname:', hostname);

      // 1) Primary path: RPC resolve_domain (when available)
      try {
        const { data, error } = await supabase.rpc('resolve_domain', {
          p_hostname: hostname,
        });

        if (!error && data && data.length > 0) {
          const result = data[0];
          console.log('[useDomainResolution] Resolved via RPC:', result);
          setState({
            blogId: result.blog_id,
            tenantId: result.tenant_id,
            domain: result.domain,
            domainType: result.domain_type as 'subdomain' | 'custom',
            status: result.status,
            isLoading: false,
            error: null,
          });
          return;
        }

        if (error) {
          console.warn('[useDomainResolution] RPC error, falling back:', error);
        }
      } catch (err) {
        console.warn('[useDomainResolution] RPC call failed, falling back:', err);
      }

      // 2) Fallback: infer by hostname + blogs table
      try {
        if (isSubaccountHost()) {
          const slug = extractSubdomainSlug();
          if (!slug) {
            setState((prev) => ({ ...prev, isLoading: false, error: 'Invalid subdomain' }));
            return;
          }

          const hostCandidates = [
            hostname,
            `${slug}.app.omniseen.app`,
            `${slug}.omniseen.app`,
            slug,
          ];

          // Try platform_subdomain matches first
          for (const candidate of hostCandidates) {
            const { data: blog } = await supabase
              .from('blogs')
              .select('id, tenant_id')
              .eq('platform_subdomain', candidate)
              .maybeSingle();

            if (blog?.id) {
              console.log('[useDomainResolution] Resolved via blogs.platform_subdomain:', { candidate, blog });
              setState({
                blogId: blog.id,
                tenantId: (blog as any).tenant_id || null,
                domain: hostname,
                domainType: 'subdomain',
                status: 'active',
                isLoading: false,
                error: null,
              });
              return;
            }
          }

          // Fallback to slug
          const { data: blogBySlug } = await supabase
            .from('blogs')
            .select('id, tenant_id')
            .eq('slug', slug)
            .maybeSingle();

          if (blogBySlug?.id) {
            console.log('[useDomainResolution] Resolved via blogs.slug:', { slug, blogBySlug });
            setState({
              blogId: blogBySlug.id,
              tenantId: (blogBySlug as any).tenant_id || null,
              domain: hostname,
              domainType: 'subdomain',
              status: 'active',
              isLoading: false,
              error: null,
            });
            return;
          }
        }

        if (isCustomDomainHost()) {
          const clean = hostname.toLowerCase();
          const { data: blogByDomain } = await supabase
            .from('blogs')
            .select('id, tenant_id')
            .eq('custom_domain', clean)
            .maybeSingle();

          if (blogByDomain?.id) {
            console.log('[useDomainResolution] Resolved via blogs.custom_domain:', { clean, blogByDomain });
            setState({
              blogId: blogByDomain.id,
              tenantId: (blogByDomain as any).tenant_id || null,
              domain: clean,
              domainType: 'custom',
              status: 'active',
              isLoading: false,
              error: null,
            });
            return;
          }
        }

        console.log('[useDomainResolution] No domain found for:', hostname);
        setState((prev) => ({ ...prev, isLoading: false, error: 'Domain not found' }));
      } catch (err) {
        console.error('[useDomainResolution] Fallback error:', err);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }));
      }
    };

    resolveDomain();
  }, []);

  return state;
}

/**
 * Resolve domínio de forma imperativa (para uso fora de componentes React)
 */
export async function resolveDomainImperative(hostname: string): Promise<{
  blogId: string | null;
  tenantId: string | null;
  error: string | null;
}> {
  try {
    const { data, error } = await supabase.rpc('resolve_domain', {
      p_hostname: hostname,
    });

    if (!error && data && data.length > 0) {
      return { blogId: data[0].blog_id, tenantId: data[0].tenant_id, error: null };
    }

    // Fallback: try blogs by custom_domain
    const { data: blogByDomain } = await supabase
      .from('blogs')
      .select('id, tenant_id')
      .eq('custom_domain', hostname)
      .maybeSingle();

    if (blogByDomain?.id) {
      return { blogId: blogByDomain.id, tenantId: (blogByDomain as any).tenant_id || null, error: null };
    }

    return { blogId: null, tenantId: null, error: error?.message || 'Domain not found' };
  } catch (err) {
    return {
      blogId: null,
      tenantId: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}