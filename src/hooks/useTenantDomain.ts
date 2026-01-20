import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DomainMode = 'platform' | 'blog' | 'unknown';

export interface DomainResolution {
  mode: DomainMode;
  blogId: string | null;
  tenantId: string | null;
  domain: string | null;
  domainType: 'subdomain' | 'custom' | null;
  status: string | null;
  loading: boolean;
  error: string | null;
}

// Domínios do sistema que nunca resolvem para blogs
const SYSTEM_DOMAINS = [
  'omniseen.app',
  'www.omniseen.app',
  'app.omniseen.app',
  'blogs.omniseen.app',
  'admin.omniseen.app'
];

// Hosts de desenvolvimento/preview
const DEV_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0'];

export function useTenantDomain(): DomainResolution {
  const [state, setState] = useState<DomainResolution>({
    mode: 'platform',
    blogId: null,
    tenantId: null,
    domain: null,
    domainType: null,
    status: null,
    loading: true,
    error: null,
  });

  // Safety timeout - fallback após 5 segundos
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (state.loading) {
        console.warn('[useTenantDomain] ⏱️ Timeout after 5s - fallback to platform mode');
        setState(s => ({ ...s, mode: 'platform', loading: false, error: 'Timeout' }));
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [state.loading]);

  useEffect(() => {
    const resolve = async () => {
      const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
      
      console.log('[useTenantDomain] ====== DOMAIN RESOLUTION START ======');
      console.log('[useTenantDomain] Hostname:', hostname);
      
      // 1. Development/Preview hosts → Platform mode
      if (DEV_HOSTS.some(h => hostname.includes(h))) {
        console.log('[useTenantDomain] 🔧 Dev host detected -> platform mode');
        setState(s => ({ ...s, mode: 'platform', loading: false }));
        return;
      }
      
      // 2. Lovable preview → Platform mode
      if (hostname.includes('lovable.app') || hostname.includes('lovableproject.com')) {
        console.log('[useTenantDomain] 🔮 Lovable preview detected -> platform mode');
        setState(s => ({ ...s, mode: 'platform', loading: false }));
        return;
      }
      
      // 3. System domains → Platform mode
      if (SYSTEM_DOMAINS.includes(hostname)) {
        console.log('[useTenantDomain] 🏢 System domain detected -> platform mode');
        setState(s => ({ ...s, mode: 'platform', loading: false }));
        return;
      }
      
      // 4. Consultar tenant_domains via RPC
      try {
        console.log('[useTenantDomain] 🔍 Querying resolve_domain for:', hostname);
        
        const { data, error } = await supabase.rpc('resolve_domain', { 
          p_hostname: hostname 
        });
        
        if (error) {
          console.error('[useTenantDomain] ❌ RPC error:', error.message);
          setState({
            mode: 'unknown',
            blogId: null,
            tenantId: null,
            domain: hostname,
            domainType: null,
            status: null,
            loading: false,
            error: error.message,
          });
          return;
        }
        
        if (data && data.length > 0) {
          const resolution = data[0];
          console.log('[useTenantDomain] ✅ Domain resolved:', resolution);
          setState({
            mode: 'blog',
            blogId: resolution.blog_id,
            tenantId: resolution.tenant_id,
            domain: resolution.domain,
            domainType: resolution.domain_type as 'subdomain' | 'custom',
            status: resolution.status,
            loading: false,
            error: null,
          });
        } else {
          console.warn('[useTenantDomain] ⚠️ Domain not found:', hostname);
          setState({
            mode: 'unknown',
            blogId: null,
            tenantId: null,
            domain: hostname,
            domainType: null,
            status: null,
            loading: false,
            error: 'Domain not found',
          });
        }
      } catch (err) {
        console.error('[useTenantDomain] ❌ Exception:', err);
        setState({
          mode: 'unknown',
          blogId: null,
          tenantId: null,
          domain: hostname,
          domainType: null,
          status: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Resolution failed',
        });
      }
    };

    resolve();
  }, []);

  return state;
}
