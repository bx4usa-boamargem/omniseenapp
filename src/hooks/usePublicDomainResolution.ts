import { useState, useEffect } from 'react';
import { fetchContentApi } from '@/hooks/useContentApi';
import { getCurrentHostname } from '@/utils/blogUrl';

interface PublicDomainResolution {
  blogId: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook para resolução de domínio público via content-api
 * 
 * IMPORTANTE: Este hook usa a edge function content-api que:
 * - Utiliza service_role (bypassa RLS)
 * - Resolve via tenant_domains OU blogs.platform_subdomain
 * - NÃO depende de autenticação do usuário
 * 
 * Usar este hook para o portal PÚBLICO (BlogRoutes)
 * O hook useDomainResolution antigo pode continuar para uso interno/admin
 */
export function usePublicDomainResolution(): PublicDomainResolution {
  const [blogId, setBlogId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const resolve = async () => {
      const hostname = getCurrentHostname();
      
      if (!hostname) {
        if (mounted) {
          setError('No hostname');
          setIsLoading(false);
        }
        return;
      }

      console.log('[usePublicDomainResolution] Resolving via content-api:', hostname);

      try {
        // Faz uma chamada mínima à content-api para obter tenant info
        const result = await fetchContentApi<{ total: number }>("blog.home", { limit: 1 }, hostname);
        
        if (!mounted) return;

        if (result?.tenant?.blog_id) {
          console.log('[usePublicDomainResolution] Resolved:', result.tenant.blog_id);
          setBlogId(result.tenant.blog_id);
          setError(null);
        } else {
          console.log('[usePublicDomainResolution] No blog found for hostname:', hostname);
          setError('Domain not found');
        }
      } catch (err) {
        console.error('[usePublicDomainResolution] Error:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Resolution failed');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    resolve();

    return () => {
      mounted = false;
    };
  }, []);

  return { blogId, isLoading, error };
}
