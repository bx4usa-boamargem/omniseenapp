/**
 * AutoProvisionTenant - v2.0 Backend-First
 * 
 * Este componente usa a edge function provision-tenant para criar
 * tenant/membership/blog de forma resiliente, evitando race conditions de RLS.
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenantContext } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, LogOut } from 'lucide-react';
import { toast } from 'sonner';

export function AutoProvisionTenant() {
  const { user, signOut } = useAuth();
  const { refetch } = useTenantContext();
  const navigate = useNavigate();
  type ProvisionTenantResponse = { status?: string };
  
  const [statusMessage, setStatusMessage] = useState('Configurando sua conta...');
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  
  const hasStarted = useRef(false);
  const hasRedirectedRef = useRef(false);

  // Guard contra múltiplos redirects
  const safeRedirect = (path: string) => {
    if (hasRedirectedRef.current) {
      console.log('[AutoProvision] Redirect already in progress, skipping');
      return;
    }
    hasRedirectedRef.current = true;
    console.log('[AutoProvision] Safe redirect to:', path);
    navigate(path, { replace: true });
  };

  const provisionTenant = async () => {
    if (!user) {
      console.log('[AutoProvision] No user, redirecting to login');
      safeRedirect('/login');
      return;
    }

    console.log('[AutoProvision] Starting provisioning for:', user.email);
    setStatusMessage('Verificando sua conta...');
    setError(null);

    try {
      // PASSO 1: Tenta refetch primeiro — talvez o tenant já exista
      // (a query anterior pode ter falhado por RLS timing)
      console.log('[AutoProvision] Step 1: Trying refetch...');
      await refetch();
      
      // Espera um momento para o estado se propagar
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Checa se o refetch achou um tenant (via ref do contexto)
      const { data: quickCheck } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      
      if (quickCheck?.tenant_id) {
        console.log('[AutoProvision] Tenant found via direct check:', quickCheck.tenant_id);
        setStatusMessage('Conta encontrada! Carregando...');
        await refetch();
        await new Promise(resolve => setTimeout(resolve, 800));
        toast.success('Conta carregada com sucesso!');
        safeRedirect('/client/dashboard');
        return;
      }

      // PASSO 2: Sem tenant, chama a Edge Function para criar
      console.log('[AutoProvision] Step 2: No tenant, calling provision-tenant...');
      setStatusMessage('Configurando sua conta...');

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('PROVISION_TIMEOUT')), 20000);
      });

      const { data, error: fnError } = await Promise.race([
        supabase.functions.invoke<ProvisionTenantResponse>('provision-tenant'),
        timeoutPromise,
      ]) as { data: ProvisionTenantResponse | null; error: Error | null };

      if (fnError) {
        console.error('[AutoProvision] Function error:', fnError);
        
        if (fnError.message?.includes('Unauthorized') || fnError.message?.includes('401')) {
          setError('Sessão expirada. Por favor, faça login novamente.');
          return;
        }
        
        // PASSO 3: Edge Function falhou — tenta refetch como último recurso
        console.warn('[AutoProvision] Step 3: Edge Function failed, trying refetch as fallback...');
        setStatusMessage('Verificando dados existentes...');
        await refetch();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data: retryCheck } = await supabase
          .from('tenant_members')
          .select('tenant_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        
        if (retryCheck?.tenant_id) {
          console.log('[AutoProvision] Tenant found on retry:', retryCheck.tenant_id);
          await refetch();
          toast.success('Conta configurada!');
          safeRedirect('/client/dashboard');
          return;
        }
        
        setError(`Falha ao configurar conta: ${fnError.message}`);
        return;
      }

      console.log('[AutoProvision] Response:', data);

      if (data?.status === 'already_provisioned' || data?.status === 'provisioned') {
        setStatusMessage('Conta configurada! Redirecionando...');
        await refetch();
        toast.success('Conta configurada com sucesso!');
        safeRedirect('/client/dashboard');
        return;
      }

      console.error('[AutoProvision] Unexpected response:', data);
      setError('Resposta inesperada do servidor. Tente novamente.');

    } catch (err) {
      if (err instanceof Error && err.message === 'PROVISION_TIMEOUT') {
        console.error('[AutoProvision] Provision timeout');
        // Mesmo com timeout, tenta refetch — o backend pode ter criado mas demorou a responder
        await refetch();
        const { data: timeoutCheck } = await supabase
          .from('tenant_members')
          .select('tenant_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();
        
        if (timeoutCheck?.tenant_id) {
          toast.success('Conta configurada!');
          safeRedirect('/client/dashboard');
          return;
        }
        
        setError('A configuração da conta demorou demais. Tente clicar em "Tentar novamente".');
        return;
      }

      console.error('[AutoProvision] Unexpected error:', err);
      setError(`Erro inesperado: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    
    provisionTenant();
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    setError(null);
    hasStarted.current = false;
    
    await provisionTenant();
    
    setIsRetrying(false);
  };

  const handleLogout = async () => {
    await signOut();
    safeRedirect('/login');
  };

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-6 max-w-md">
          <div className="p-4 rounded-full bg-destructive/10 inline-block">
            <RefreshCw className="h-8 w-8 text-destructive" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Ops! Algo deu errado</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={handleRetry} 
              disabled={isRetrying}
              className="gap-2"
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Tentar novamente
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Fazer login novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Configurando sua conta</h2>
          <p className="text-muted-foreground">{statusMessage}</p>
        </div>
      </div>
    </div>
  );
}
