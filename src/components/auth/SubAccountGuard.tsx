/**
 * SubAccountGuard - Guard para rotas /client/*
 * 
 * - Verifica autenticação
 * - Verifica se user tem tenant
 * - Se não tem tenant -> auto-provisiona
 * - NUNCA faz signOut automático por timeout
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
  const [showManualAction, setShowManualAction] = useState(false);

  const isLoading = authLoading || tenantLoading;

  // After 8s of loading, show a manual action button (but never force logout)
  useEffect(() => {
    if (!isLoading) {
      setShowManualAction(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowManualAction(true);
    }, 8000);

    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
        {showManualAction && (
          <div className="flex flex-col items-center gap-2 mt-4">
            <p className="text-xs text-muted-foreground">O carregamento está demorando mais que o esperado.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Recarregar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => window.location.href = '/login'}>
                Ir para login
              </Button>
            </div>
          </div>
        )}
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
          <div className="flex flex-col gap-2">
            <Button onClick={() => refetch()} className="w-full gap-2">
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/login'} className="w-full">
              Voltar ao login
            </Button>
          </div>
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
