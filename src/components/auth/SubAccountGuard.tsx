/**
 * SubAccountGuard - Guard para rotas /client/*
 * 
 * REBUILD v2: Usa TenantContext em vez de useBlog/useIsSubAccount
 * - Verifica autenticação
 * - Verifica se user tem tenant
 * - Redireciona para /onboarding se não tem tenant
 */
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTenantContext } from '@/contexts/TenantContext';
import { Loader2 } from 'lucide-react';

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

  // No tenant -> onboarding
  if (!hasTenant || !currentTenant) {
    console.log('[SubAccountGuard] No tenant, redirecting to /onboarding');
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
