/**
 * SubAccountGuard - Guard para rotas /client/*
 * 
 * REBUILD v3: Auto-provisioning sem onboarding manual
 * - Verifica autenticação
 * - Verifica se user tem tenant
 * - Se não tem tenant -> auto-provisiona
 */
import { ReactNode, useEffect, useRef, useState } from 'react';
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
  const { user, loading: authLoading, signOut } = useAuth();
  const { currentTenant, loading: tenantLoading, hasTenant, error, refetch } = useTenantContext();
  const [forceLoginRedirect, setForceLoginRedirect] = useState(false);
  const loadingStartedAtRef = useRef<number | null>(null);

  const isLoading = authLoading || tenantLoading;

  useEffect(() => {
    if (!isLoading) {
      loadingStartedAtRef.current = null;
      setForceLoginRedirect(false);
      return;
    }

    if (loadingStartedAtRef.current === null) {
      loadingStartedAtRef.current = Date.now();
    }

    const elapsed = Date.now() - loadingStartedAtRef.current;
    const softDelay = Math.max(0, 3000 - elapsed);
    const hardDelay = Math.max(0, 5000 - elapsed);

    const softRedirectTimer = window.setTimeout(() => {
      if (!user) {
        console.warn('[SubAccountGuard] Loading exceeded 3 seconds without user, redirecting to login.');
        setForceLoginRedirect(true);
      }
    }, softDelay);

    const hardAuthTimer = window.setTimeout(() => {
      if (authLoading) {
        console.warn('[SubAccountGuard] Auth still loading after 5 seconds, forcing unauthenticated redirect.');
        void signOut().finally(() => setForceLoginRedirect(true));
        return;
      }

      if (tenantLoading) {
        console.warn('[SubAccountGuard] Tenant resolution still loading after 5 seconds, clearing session and redirecting to login.');
        void signOut().finally(() => setForceLoginRedirect(true));
      }
    }, hardDelay);

    return () => {
      clearTimeout(softRedirectTimer);
      clearTimeout(hardAuthTimer);
    };
  }, [isLoading, authLoading, tenantLoading, user, signOut]);

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
