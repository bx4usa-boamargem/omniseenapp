/**
 * TenantGuard - Guard para rotas protegidas do app
 * 
 * Verifica:
 * 1. User está autenticado?
 * 2. User tem pelo menos um tenant?
 * 
 * Se não tem tenant -> auto-provisiona (sem onboarding manual)
 * Se tem tenant -> renderiza children
 */
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTenantContext } from '@/contexts/TenantContext';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutoProvisionTenant } from './AutoProvisionTenant';

interface TenantGuardProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function TenantGuard({ children, requireAdmin = false }: TenantGuardProps) {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const { 
    currentTenant, 
    loading: tenantLoading, 
    error, 
    hasTenant,
    isAdmin,
    refetch 
  } = useTenantContext();

  const isLoading = authLoading || tenantLoading;

  // Loading state com fallback
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Erro ao carregar tenant - se usuário está logado, tenta auto-provisionar
  // (provision-tenant é idempotente - não cria duplicatas)
  if (error && user) {
    console.log('[TenantGuard] Error loading tenant, attempting auto-provision for:', user.email);
    return <AutoProvisionTenant />;
  }

  // Erro sem usuário -> login
  if (error && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4">
        <div className="bg-card border rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold">Sessão expirada</h2>
          <p className="text-muted-foreground">Faça login novamente para acessar sua conta.</p>
          <Button 
            onClick={() => window.location.href = '/login'}
            className="w-full"
          >
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

  // Não autenticado -> login
  if (!user) {
    console.log('[TenantGuard] No user, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Sem tenant -> auto-provisionar (sem onboarding manual)
  if (!hasTenant || !currentTenant) {
    console.log('[TenantGuard] No tenant, auto-provisioning...');
    return <AutoProvisionTenant />;
  }

  // Requer admin mas não é admin
  if (requireAdmin && !isAdmin) {
    console.log('[TenantGuard] Not admin, access denied');
    return <Navigate to="/access-denied" replace />;
  }

  // Tudo OK -> renderiza children
  return <>{children}</>;
}
