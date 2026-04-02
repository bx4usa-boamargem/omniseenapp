/**
 * TenantContext - Contexto para gerenciamento de tenant no SaaS multi-tenant
 * 
 * NÃO depende de hostname para resolver tenant.
 * Resolve tenant via tenant_members do usuário logado.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const withTimeout = <T,>(promise: PromiseLike<T>, timeoutMs: number, timeoutCode: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutCode)), timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string | null;
  plan: string | null;
  status: string | null;
  created_at: string | null;
}

export interface TenantMembership {
  id: string;
  tenant_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string | null;
  tenant: Tenant;
}

interface TenantContextValue {
  // Estado
  currentTenant: Tenant | null;
  currentMembership: TenantMembership | null;
  allMemberships: TenantMembership[];
  loading: boolean;
  error: string | null;
  
  // Helpers
  isOwner: boolean;
  isAdmin: boolean;
  hasTenant: boolean;
  
  // Ações
  switchTenant: (tenantId: string) => void;
  refetch: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | null>(null);

interface TenantProviderProps {
  children: ReactNode;
}

export function TenantProvider({ children }: TenantProviderProps) {
  const { user, loading: authLoading } = useAuth();
  
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [currentMembership, setCurrentMembership] = useState<TenantMembership | null>(null);
  const [allMemberships, setAllMemberships] = useState<TenantMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fallback: resolver tenant via tabela blogs
  const fetchTenantViaBlogs = useCallback(async (): Promise<TenantMembership | null> => {
    if (!user) return null;
    try {
      const { data: userBlogs, error: blogsError } = await supabase
        .from('blogs')
        .select('tenant_id, tenants(*)')
        .eq('user_id', user.id)
        .not('tenant_id', 'is', null)
        .limit(1);

      if (blogsError || !userBlogs?.length) return null;

      const blogTenant = userBlogs[0].tenants as unknown as Tenant;
      if (!blogTenant) return null;

      return {
        id: 'fallback-blog',
        tenant_id: blogTenant.id,
        user_id: user.id,
        role: 'owner',
        joined_at: null,
        tenant: blogTenant,
      };
    } catch {
      return null;
    }
  }, [user]);

  const fetchMemberships = useCallback(async (retryCount = 0) => {
    if (!user) {
      setCurrentTenant(null);
      setCurrentMembership(null);
      setAllMemberships([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // MÉTODO 1: RPC com SECURITY DEFINER (bypassa RLS)
      console.log('[TenantContext] Fetching via RPC get_my_memberships...');
      const { data: rpcData, error: rpcError } = await withTimeout(
        Promise.resolve(
          (supabase.rpc as any)('get_my_memberships')
        ),
        15000,
        'MEMBERSHIPS_TIMEOUT'
      );

      if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
        console.log('[TenantContext] RPC success:', rpcData.length, 'memberships');
        const formattedFromRpc: TenantMembership[] = rpcData.map((row: any) => ({
          id: row.id,
          tenant_id: row.tenant_id,
          user_id: row.user_id,
          role: row.role as 'owner' | 'admin' | 'member',
          joined_at: row.joined_at,
          tenant: {
            id: row.tenant_id,
            name: row.tenant_name,
            slug: row.tenant_slug,
            owner_user_id: row.tenant_owner_user_id,
            plan: row.tenant_plan,
            status: row.tenant_status,
            created_at: row.tenant_created_at,
          },
        }));

        setAllMemberships(formattedFromRpc);
        const ownerM = formattedFromRpc.find(m => m.role === 'owner');
        const selected = ownerM || formattedFromRpc[0];
        if (selected) {
          setCurrentMembership(selected);
          setCurrentTenant(selected.tenant);
        }
        setLoading(false);
        return;
      }

      // RPC falhou ou retornou vazio — log e tenta fallback
      if (rpcError) {
        console.warn('[TenantContext] RPC error (maybe not deployed yet):', rpcError.message);
      } else {
        console.warn('[TenantContext] RPC returned empty, trying direct query...');
      }

      // MÉTODO 2: Query direta EM DUAS ETAPAS (evita loop circular do RLS)
      console.log('[TenantContext] Attempting 2-step direct query...');
      const membershipsResult = await withTimeout(
        Promise.resolve(
          supabase
            .from('tenant_members')
            .select('*')
            .eq('user_id', user.id)
        ),
        15000,
        'MEMBERSHIPS_TIMEOUT'
      );

      const { data: rawMemberships, error: membershipsError } = membershipsResult;

      if (membershipsError) {
        console.warn('[TenantContext] Direct query error:', membershipsError.message);
      }

      let joinedMemberships: any[] = [];

      if (rawMemberships && rawMemberships.length > 0) {
        const tenantIds = rawMemberships.map(m => m.tenant_id);
        const { data: tenantsData } = await supabase
          .from('tenants')
          .select('*')
          .in('id', tenantIds);

        if (tenantsData) {
          joinedMemberships = rawMemberships.map(m => {
            const tenantMatch = tenantsData.find(t => t.id === m.tenant_id);
            if (tenantMatch) {
              return {
                id: m.id,
                tenant_id: m.tenant_id,
                user_id: m.user_id,
                role: m.role,
                joined_at: m.joined_at,
                tenant: tenantMatch
              };
            }
            return null;
          }).filter(Boolean);
        }
      }

      if (joinedMemberships.length > 0) {
        console.log('[TenantContext] 2-step query success:', joinedMemberships.length, 'memberships');
        const formattedDirect: TenantMembership[] = joinedMemberships.map((m: any) => ({
          id: m.id,
          tenant_id: m.tenant_id,
          user_id: m.user_id,
          role: m.role as 'owner' | 'admin' | 'member',
          joined_at: m.joined_at,
          tenant: m.tenant,
        }));

        setAllMemberships(formattedDirect);
        const ownerM = formattedDirect.find(m => m.role === 'owner');
        const selected = ownerM || formattedDirect[0];
        if (selected) {
          setCurrentMembership(selected);
          setCurrentTenant(selected.tenant);
        }
        setLoading(false);
        return;
      } else {
        // MÉTODO 3: Fallback via blogs  
        console.warn('[TenantContext] Direct query empty, trying blogs fallback...');
        const fallback = await fetchTenantViaBlogs();
        if (fallback) {
          setAllMemberships([fallback]);
          setCurrentMembership(fallback);
          setCurrentTenant(fallback.tenant);
          setLoading(false);
          return;
        }

        // Nenhum método funcionou — sem tenant
        console.warn('[TenantContext] All methods exhausted, no tenant found');
        setAllMemberships([]);
        setCurrentTenant(null);
        setCurrentMembership(null);
        setLoading(false);
        return;
      }

    } catch (err) {
      if (err instanceof Error && err.message === 'MEMBERSHIPS_TIMEOUT') {
        if (retryCount < 2) {
          setTimeout(() => fetchMemberships(retryCount + 1), (retryCount + 1) * 2000);
          return;
        }

        // Fallback via blogs
        const fallback = await fetchTenantViaBlogs();
        if (fallback) {
          setAllMemberships([fallback]);
          setCurrentMembership(fallback);
          setCurrentTenant(fallback.tenant);
          setLoading(false);
          return;
        }

        // Trata como "sem memberships" para que o auto-provisioning rode
        console.warn('[TenantContext] Timeout after retries, treating as no-tenant');
        setAllMemberships([]);
        setCurrentTenant(null);
        setCurrentMembership(null);
        return;
      }

      console.error('[TenantContext] Unexpected fetch error:', err);
      // Mesmo em erro inesperado, não trava - deixa os guards lidar
      setAllMemberships([]);
      setCurrentTenant(null);
      setCurrentMembership(null);
    } finally {
      setLoading(false);
    }
  }, [user, fetchTenantViaBlogs]);

  // Refetch quando user muda
  useEffect(() => {
    if (!authLoading) {
      fetchMemberships();
    }
  }, [user?.id, authLoading, fetchMemberships]);

  // Switch para outro tenant
  const switchTenant = useCallback((tenantId: string) => {
    const membership = allMemberships.find(m => m.tenant_id === tenantId);
    if (membership) {
      setCurrentMembership(membership);
      setCurrentTenant(membership.tenant);
    }
  }, [allMemberships]);

  // Computed values
  const isOwner = currentMembership?.role === 'owner';
  const isAdmin = currentMembership?.role === 'owner' || currentMembership?.role === 'admin';
  const hasTenant = currentTenant !== null;

  const value: TenantContextValue = {
    currentTenant,
    currentMembership,
    allMemberships,
    loading: loading || authLoading,
    error,
    isOwner,
    isAdmin,
    hasTenant,
    switchTenant,
    refetch: fetchMemberships,
  };

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenantContext(): TenantContextValue {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenantContext must be used within TenantProvider');
  }
  return context;
}

// Hook conveniente para usar em guards
export function useCurrentTenant() {
  const { currentTenant, loading, hasTenant } = useTenantContext();
  return { tenant: currentTenant, loading, hasTenant };
}
