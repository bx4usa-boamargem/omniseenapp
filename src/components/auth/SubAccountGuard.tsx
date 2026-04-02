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
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { AutoProvisionTenant } from './AutoProvisionTenant';
import { Button } from '@/components/ui/button';

interface SubAccountGuardProps {
  children: ReactNode;
}

export function SubAccountGuard({ children }: SubAccountGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { currentTenant, loading: tenantLoading, hasTenant, error, refetch } = useTenantContext();

  const isLoading = authLoading || tenantLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Erro ao carregar tenant + user logado → tenta auto-provisionar
  // (provision-tenant é idempotente, não cria duplicatas)
  if (error && user) {
    console.log('[SubAccountGuard] Error loading tenant, auto-provisioning for:', user.email);
    return <AutoProvisionTenant />;
  }

  // Erro sem user → tela de erro com botão de login
  if (error && !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4">
        <div className="bg-card border rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold">Sessão expirada</h2>
          <p className="text-muted-foreground">Faça login novamente para acessar sua conta.</p>
          <Button onClick={() => window.location.href = '/login'} className="w-full">
            Ir para o login
          </Button>
        </div>
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
