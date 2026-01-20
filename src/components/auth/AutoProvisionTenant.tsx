/**
 * AutoProvisionTenant - Cria tenant/blog automaticamente sem inputs do usuário
 * 
 * Fluxo:
 * 1. Gera nome/slug a partir do email do usuário
 * 2. Cria tenant, membership, blog e domain
 * 3. Redireciona para /client/dashboard
 * 
 * Tratamento de colisões:
 * - Se slug existe, adiciona sufixo aleatório e tenta novamente (até 5x)
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTenantContext } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

const SUBDOMAIN_SUFFIX = '.omniseen.app';
const MAX_SLUG_ATTEMPTS = 5;

// Gera slug a partir do email
function generateSlugFromEmail(email: string): string {
  const localPart = email.split('@')[0] || 'user';
  return localPart
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 20);
}

// Gera sufixo aleatório
function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 6);
}

export function AutoProvisionTenant() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { refetch } = useTenantContext();

  const [status, setStatus] = useState<'provisioning' | 'error'>('provisioning');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSessionExpired = useCallback(async () => {
    toast({
      title: 'Sessão expirada',
      description: 'Faça login novamente.',
      variant: 'destructive',
    });
    await signOut();
    window.location.href = '/login';
  }, [signOut]);

  const handleGoToLogin = useCallback(() => {
    window.location.href = '/login';
  }, []);

  const provisionTenant = useCallback(async () => {
    if (!user?.email) {
      setStatus('error');
      setErrorMessage('Usuário não autenticado');
      return;
    }

    const email = user.email;
    const fullName = user.user_metadata?.full_name || email.split('@')[0] || 'Usuário';
    const baseSlug = generateSlugFromEmail(email);

    let attempt = 0;
    let slug = baseSlug;
    let tenantCreated = false;

    while (attempt < MAX_SLUG_ATTEMPTS && !tenantCreated) {
      attempt++;
      console.log(`[AutoProvision] Attempt ${attempt} with slug: ${slug}`);

      try {
        // 1. Criar tenant
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .insert({
            name: fullName,
            slug: slug,
            owner_user_id: user.id,
            status: 'active',
          })
          .select('id')
          .single();

        if (tenantError) {
          // Colisão de slug -> tentar novamente
          if (tenantError.code === '23505' || tenantError.message?.includes('duplicate')) {
            slug = `${baseSlug}-${randomSuffix()}`;
            continue;
          }

          // Sessão expirada
          if (tenantError.message?.includes('row-level security') ||
              tenantError.message?.includes('policy') ||
              tenantError.message?.includes('JWT')) {
            await handleSessionExpired();
            return;
          }

          throw new Error(tenantError.message);
        }

        if (!tenantData) {
          throw new Error('Falha ao criar conta');
        }

        const tenantId = tenantData.id;
        const subdomain = `${slug}${SUBDOMAIN_SUFFIX}`;

        // 2. Criar membership
        const { error: memberError } = await supabase
          .from('tenant_members')
          .insert({
            tenant_id: tenantId,
            user_id: user.id,
            role: 'owner',
          });

        if (memberError) {
          if (memberError.message?.includes('row-level security')) {
            await handleSessionExpired();
            return;
          }
          console.error('[AutoProvision] Member error:', memberError);
        }

        // 3. Criar blog
        const { data: blogData, error: blogError } = await supabase
          .from('blogs')
          .insert({
            tenant_id: tenantId,
            user_id: user.id,
            name: fullName,
            slug: slug,
            platform_subdomain: subdomain,
            onboarding_completed: true,
          })
          .select('id')
          .single();

        if (blogError) {
          if (blogError.message?.includes('row-level security')) {
            await handleSessionExpired();
            return;
          }
          console.error('[AutoProvision] Blog error:', blogError);
        }

        // 4. Criar domain (não crítico)
        if (blogData) {
          await supabase
            .from('tenant_domains')
            .insert({
              tenant_id: tenantId,
              blog_id: blogData.id,
              domain: subdomain,
              domain_type: 'subdomain',
              status: 'pending',
              is_primary: true,
            });
        }

        // 5. Atualizar profile (não crítico)
        await supabase
          .from('profiles')
          .update({
            full_name: fullName,
            onboarding_completed: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        // Sucesso!
        tenantCreated = true;
        console.log('[AutoProvision] Tenant created successfully:', tenantId);

        // Refetch e navegar
        await refetch();
        navigate('/client/dashboard', { replace: true });

      } catch (err) {
        console.error('[AutoProvision] Error:', err);
        
        if (attempt >= MAX_SLUG_ATTEMPTS) {
          setStatus('error');
          setErrorMessage(err instanceof Error ? err.message : 'Erro ao configurar conta');
          return;
        }
        
        // Tentar próximo slug
        slug = `${baseSlug}-${randomSuffix()}`;
      }
    }

    if (!tenantCreated) {
      setStatus('error');
      setErrorMessage('Não foi possível criar sua conta. Tente novamente mais tarde.');
    }
  }, [user, handleSessionExpired, refetch, navigate]);

  useEffect(() => {
    provisionTenant();
  }, [provisionTenant]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4">
        <div className="bg-card border rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold">Erro ao configurar conta</h2>
          <p className="text-muted-foreground">{errorMessage}</p>
          <Button onClick={handleGoToLogin} className="w-full gap-2">
            <LogIn className="h-4 w-4" />
            Ir para login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Configurando sua conta...</p>
    </div>
  );
}
