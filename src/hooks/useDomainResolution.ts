import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentHostname } from '@/utils/blogUrl';

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
        setState(prev => ({ ...prev, isLoading: false, error: 'No hostname' }));
        return;
      }

      console.log('[useDomainResolution] Resolving hostname:', hostname);

      try {
        const { data, error } = await supabase.rpc('resolve_domain', {
          p_hostname: hostname
        });

        if (error) {
          console.error('[useDomainResolution] RPC error:', error);
          setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            error: error.message 
          }));
          return;
        }

        if (data && data.length > 0) {
          const result = data[0];
          console.log('[useDomainResolution] Resolved:', result);
          setState({
            blogId: result.blog_id,
            tenantId: result.tenant_id,
            domain: result.domain,
            domainType: result.domain_type as 'subdomain' | 'custom',
            status: result.status,
            isLoading: false,
            error: null,
          });
        } else {
          console.log('[useDomainResolution] No domain found for:', hostname);
          setState(prev => ({ 
            ...prev, 
            isLoading: false, 
            error: 'Domain not found' 
          }));
        }
      } catch (err) {
        console.error('[useDomainResolution] Error:', err);
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: err instanceof Error ? err.message : 'Unknown error' 
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
      p_hostname: hostname
    });

    if (error) {
      return { blogId: null, tenantId: null, error: error.message };
    }

    if (data && data.length > 0) {
      return { 
        blogId: data[0].blog_id, 
        tenantId: data[0].tenant_id, 
        error: null 
      };
    }

    return { blogId: null, tenantId: null, error: 'Domain not found' };
  } catch (err) {
    return { 
      blogId: null, 
      tenantId: null, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    };
  }
}
