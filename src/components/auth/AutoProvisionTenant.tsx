/**
 * AutoProvisionTenant - Cria tenant/blog automaticamente sem inputs do usuário
 * 
 * Fluxo:
 * 1. Verifica se já existe membership (evita duplicação)
 * 2. Gera nome/slug a partir do email do usuário
 * 3. Cria tenant, membership, blog e domain
 * 4. Redireciona para /client/dashboard
 * 
 * Tratamento de colisões:
 * - Se slug existe, adiciona sufixo aleatório e tenta novamente (até 5x)
 * - Se blog já existe para o user, reutiliza o existente
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTenantContext } from '@/contexts/TenantContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertTriangle, LogIn, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

// NOVO PADRÃO: {slug}.app.omniseen.app
const SUBDOMAIN_SUFFIX = '.app.omniseen.app';
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
  const hasStarted = useRef(false);

  const [status, setStatus] = useState<'checking' | 'provisioning' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('Verificando sua conta...');

  const handleSessionExpired = useCallback(async () => {
    console.log('[AutoProvision] Session expired, redirecting to login');
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

  const handleRetry = useCallback(() => {
    hasStarted.current = false;
    setStatus('checking');
    setErrorMessage('');
    setStatusMessage('Verificando sua conta...');
    window.location.reload();
  }, []);

  const provisionTenant = useCallback(async () => {
    // Prevent multiple executions
    if (hasStarted.current) {
      console.log('[AutoProvision] Already started, skipping');
      return;
    }
    hasStarted.current = true;

    if (!user?.email) {
      console.error('[AutoProvision] No user or email');
      setStatus('error');
      setErrorMessage('Usuário não autenticado');
      return;
    }

    console.log('[AutoProvision] Starting for user:', user.email);

    try {
      // ========= STEP 1: Check if user already has a membership =========
      setStatusMessage('Verificando conta existente...');
      
      const { data: existingMembership, error: membershipError } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        console.error('[AutoProvision] Error checking membership:', membershipError);
        // RLS or session issue
        if (membershipError.message?.includes('row-level security') ||
            membershipError.message?.includes('JWT')) {
          await handleSessionExpired();
          return;
        }
      }

      if (existingMembership?.tenant_id) {
        console.log('[AutoProvision] User already has tenant:', existingMembership.tenant_id);
        // User already has a tenant, just refetch and navigate
        await refetch();
        navigate('/client/dashboard', { replace: true });
        return;
      }

      // ========= STEP 2: Check if user has a blog without tenant =========
      setStatusMessage('Verificando configuração...');
      
      const { data: existingBlog } = await supabase
        .from('blogs')
        .select('id, tenant_id, name, slug')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (existingBlog?.tenant_id) {
        // Blog exists with tenant, create membership if missing
        console.log('[AutoProvision] Blog exists with tenant, checking membership');
        
        const { error: createMemberError } = await supabase
          .from('tenant_members')
          .insert({
            tenant_id: existingBlog.tenant_id,
            user_id: user.id,
            role: 'owner',
          });

        if (createMemberError && !createMemberError.message?.includes('duplicate')) {
          console.error('[AutoProvision] Error creating membership:', createMemberError);
        }

        await refetch();
        navigate('/client/dashboard', { replace: true });
        return;
      }

      // ========= STEP 3: Create new tenant =========
      setStatus('provisioning');
      setStatusMessage('Configurando sua conta...');

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
          // Create tenant
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
            // Slug collision -> try again
            if (tenantError.code === '23505' || tenantError.message?.includes('duplicate')) {
              console.log('[AutoProvision] Slug collision, generating new one');
              slug = `${baseSlug}-${randomSuffix()}`;
              continue;
            }

            // Session expired
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
          console.log('[AutoProvision] Tenant created:', tenantId);

          // Create membership
          setStatusMessage('Configurando permissões...');
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
            // Log but continue - non-critical if duplicate
            if (!memberError.message?.includes('duplicate')) {
              console.error('[AutoProvision] Member error:', memberError);
            }
          }

          // Create or update blog
          setStatusMessage('Criando seu blog...');
          let blogId: string | null = null;

          if (existingBlog?.id) {
            // Update existing blog with tenant_id
            console.log('[AutoProvision] Updating existing blog with tenant_id');
            await supabase
              .from('blogs')
              .update({ 
                tenant_id: tenantId,
                platform_subdomain: subdomain,
                onboarding_completed: true 
              })
              .eq('id', existingBlog.id);
            blogId = existingBlog.id;
          } else {
            // Create new blog
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
              // Log but don't fail - blog creation is important but we can recover
              console.error('[AutoProvision] Blog error:', blogError);
            } else {
              blogId = blogData?.id || null;
            }
          }

          // Create domain (non-critical)
          if (blogId) {
            setStatusMessage('Finalizando configuração...');
            await supabase
              .from('tenant_domains')
              .insert({
                tenant_id: tenantId,
                blog_id: blogId,
                domain: subdomain,
                domain_type: 'subdomain',
                status: 'pending',
                is_primary: true,
              });
          }

          // Update profile (non-critical)
          await supabase
            .from('profiles')
            .update({
              full_name: fullName,
              onboarding_completed: true,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', user.id);

          // Success!
          tenantCreated = true;
          console.log('[AutoProvision] Tenant created successfully:', tenantId);

          // Refetch and navigate
          await refetch();
          
          toast({
            title: 'Conta configurada!',
            description: 'Bem-vindo ao Omniseen!',
          });
          
          navigate('/client/dashboard', { replace: true });

        } catch (err) {
          console.error('[AutoProvision] Error:', err);
          
          if (attempt >= MAX_SLUG_ATTEMPTS) {
            setStatus('error');
            setErrorMessage(err instanceof Error ? err.message : 'Erro ao configurar conta');
            
            // Save error for debugging
            try {
              localStorage.setItem('lastProvisionError', JSON.stringify({
                timestamp: Date.now(),
                error: err instanceof Error ? err.message : 'Unknown error',
                userId: user.id,
                email: user.email,
              }));
            } catch {}
            
            return;
          }
          
          // Try next slug
          slug = `${baseSlug}-${randomSuffix()}`;
        }
      }

      if (!tenantCreated) {
        setStatus('error');
        setErrorMessage('Não foi possível criar sua conta. Tente novamente mais tarde.');
      }

    } catch (err) {
      console.error('[AutoProvision] Unexpected error:', err);
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Erro inesperado ao configurar conta');
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
          <div className="flex flex-col gap-2">
            <Button onClick={handleRetry} variant="outline" className="w-full gap-2">
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </Button>
            <Button onClick={handleGoToLogin} className="w-full gap-2">
              <LogIn className="h-4 w-4" />
              Ir para login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">{statusMessage}</p>
    </div>
  );
}
