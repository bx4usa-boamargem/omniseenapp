/**
 * TenantContext - Contexto para gerenciamento de tenant no SaaS multi-tenant
 * 
 * NÃO depende de hostname para resolver tenant.
 * Resolve tenant via tenant_members do usuário logado.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, timeoutCode: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutCode)), timeoutMs);

    promise
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

  const fetchMemberships = useCallback(async () => {
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

      console.log('[TenantContext] Fetching memberships for user:', user.id);

      // Buscar todas as memberships do usuário com dados do tenant
      const { data: memberships, error: membershipsError } = await withTimeout(
        supabase
          .from('tenant_members')
          .select(`
            id,
            tenant_id,
            user_id,
            role,
            joined_at,
            tenant:tenants (
              id,
              name,
              slug,
              owner_user_id,
              plan,
              status,
              created_at
            )
          `)
          .eq('user_id', user.id),
        15000,
        'MEMBERSHIPS_TIMEOUT'
      );

      if (membershipsError) {
        console.error('[TenantContext] Error fetching memberships:', membershipsError);
        setError('Erro ao carregar dados do tenant');
        setLoading(false);
        return;
      }

      if (!memberships || memberships.length === 0) {
        console.log('[TenantContext] No memberships found');
        setAllMemberships([]);
        setCurrentTenant(null);
        setCurrentMembership(null);
        setLoading(false);
        return;
      }

      // Transformar dados para o formato esperado
      const formattedMemberships: TenantMembership[] = memberships
        .filter(m => m.tenant) // Garantir que tem tenant
        .map(m => ({
          id: m.id,
          tenant_id: m.tenant_id,
          user_id: m.user_id,
          role: m.role as 'owner' | 'admin' | 'member',
          joined_at: m.joined_at,
          tenant: m.tenant as unknown as Tenant,
        }));

      setAllMemberships(formattedMemberships);

      // Selecionar tenant atual: preferir owner, ou primeiro da lista
      const ownerMembership = formattedMemberships.find(m => m.role === 'owner');
      const selectedMembership = ownerMembership || formattedMemberships[0];

      if (selectedMembership) {
        setCurrentMembership(selectedMembership);
        setCurrentTenant(selectedMembership.tenant);
        console.log('[TenantContext] Selected tenant:', selectedMembership.tenant.name);
      }

    } catch (err) {
      if (err instanceof Error && err.message === 'MEMBERSHIPS_TIMEOUT') {
        console.error('[TenantContext] Timeout fetching memberships');
        setError('O backend está demorando para carregar sua conta. Tente novamente em instantes.');
        return;
      }

      console.error('[TenantContext] Unexpected error:', err);
      setError('Erro inesperado ao carregar tenant');
    } finally {
      setLoading(false);
    }
  }, [user]);

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
      console.log('[TenantContext] Switched to tenant:', membership.tenant.name);
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
