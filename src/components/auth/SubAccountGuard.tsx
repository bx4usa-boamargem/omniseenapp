/**
 * SubAccountGuard - Guard para rotas /client/*
 * 
 * REBUILD v3: Auto-provisioning sem onboarding manual
 * - Verifica autenticação
 * - Verifica se user tem tenant
 * - Se não tem tenant -> auto-provisiona
 */
import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTenantContext } from '@/contexts/TenantContext';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { AutoProvisionTenant } from './AutoProvisionTenant';
import { Button } from '@/components/ui/button';

interface SubAccountGuardProps {
  children: ReactNode;
}

export function SubAccountGuard({ children }: SubAccountGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading, hasTenant, error, refetch } = useTenantContext();
  const [forceLoginRedirect, setForceLoginRedirect] = useState(false);

  const isLoading = authLoading || tenantLoading;

  useEffect(() => {
    if (!isLoading) {
      setForceLoginRedirect(false);
      return;
    }

    const softRedirectTimer = window.setTimeout(() => {
      if (!user) {
        console.warn('[SubAccountGuard] Loading exceeded 3 seconds without user, redirecting to login.');
        setForceLoginRedirect(true);
      }
    }, 3000);

    const hardAuthTimer = window.setTimeout(() => {
      if (authLoading) {
        console.warn('[SubAccountGuard] Auth still loading after 5 seconds, forcing unauthenticated redirect.');
        setForceLoginRedirect(true);
      }
    }, 5000);

    return () => {
      clearTimeout(softRedirectTimer);
      clearTimeout(hardAuthTimer);
    };
  }, [isLoading, authLoading, user]);

  if (forceLoginRedirect) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4">
        <div className="bg-card border rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold">Erro ao carregar</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => refetch()} className="w-full gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!user) {
    console.log('[SubAccountGuard] No user, redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  if (!hasTenant || !currentTenant) {
    console.log('[SubAccountGuard] No tenant, auto-provisioning...');
    return <AutoProvisionTenant />;
  }

  return <>{children}</>;
}
