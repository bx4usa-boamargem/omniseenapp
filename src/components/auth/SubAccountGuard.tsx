/**
 * SubAccountGuard - Guard para rotas /client/*
 * 
 * REBUILD v3: Auto-provisioning sem onboarding manual
 * - Verifica autenticação
 * - Verifica se user tem tenant
 * - Se não tem tenant -> auto-provisiona
 */
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTenantContext } from '@/contexts/TenantContext';
import { Loader2 } from 'lucide-react';
import { AutoProvisionTenant } from './AutoProvisionTenant';

interface SubAccountGuardProps {
  children: ReactNode;
}

export function SubAccountGuard({ children }: SubAccountGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading, hasTenant } = useTenantContext();

  const isLoading = authLoading || tenantLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Not authenticated -> login
  if (!user) {
    console.log('[SubAccountGuard] No user, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  // No tenant -> auto-provision (sem onboarding manual)
  if (!hasTenant || !currentTenant) {
    console.log('[SubAccountGuard] No tenant, auto-provisioning...');
    return <AutoProvisionTenant />;
  }

  return <>{children}</>;
}
