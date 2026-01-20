/**
 * Onboarding Page - Nova implementação do zero
 * 
 * Fluxo de 3 passos:
 * 1. Dados básicos (nome, telefone, empresa, slug)
 * 2. Criar tenant + membership + blog + domain
 * 3. Confirmação com checklist
 * 
 * Características:
 * - Sem Radix/Portal nos componentes (inputs nativos)
 * - ErrorBoundary para evitar tela branca
 * - Transacional e idempotente
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { OmniseenLogo } from '@/components/ui/OmniseenLogo';
import { 
  Building2, 
  User, 
  Phone, 
  Globe, 
  ArrowRight, 
  ArrowLeft,
  Loader2, 
  AlertTriangle,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

// Constante do sistema para subdomínio
const SUBDOMAIN_SUFFIX = '.omniseen.app';

// Error Boundary Fallback
function OnboardingErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Erro no onboarding</h2>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <div className="flex flex-col gap-3">
          <Button onClick={() => window.location.reload()} className="w-full">
            Recarregar página
          </Button>
          <Button variant="outline" onClick={resetErrorBoundary} className="w-full">
            Tentar novamente
          </Button>
          <Button variant="ghost" onClick={() => window.location.href = '/login'} className="w-full">
            Voltar ao login
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Onboarding() {
  return (
    <ErrorBoundary 
      FallbackComponent={OnboardingErrorFallback}
      onReset={() => window.location.reload()}
    >
      <OnboardingContent />
    </ErrorBoundary>
  );
}

// Helpers para gerar slug
function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]+/g, '-')     // Substitui não-alfanuméricos por -
    .replace(/^-+|-+$/g, '')          // Remove - do início e fim
    .substring(0, 30);                // Limita tamanho
}

function OnboardingContent() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Estado do wizard
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingExisting, setIsCheckingExisting] = useState(true);
  const [canProceed, setCanProceed] = useState(false);

  // Dados do formulário - Step 1
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);

  // Validação de slug em tempo real
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  // Dados criados - Step 3
  const [createdTenantId, setCreatedTenantId] = useState<string | null>(null);
  const [createdSubdomain, setCreatedSubdomain] = useState<string>('');

  // Debug logs
  useEffect(() => {
    console.log('[Onboarding] Component mounted');
    console.log('[Onboarding] authLoading:', authLoading, 'user:', user?.email);
  }, [authLoading, user]);

  // Redirect se não autenticado
  useEffect(() => {
    if (!authLoading && !user) {
      console.log('[Onboarding] Not authenticated, redirecting to login');
      navigate('/login', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Função para verificar disponibilidade do slug
  const checkSlugAvailability = useCallback(async (slugToCheck: string): Promise<boolean> => {
    if (!slugToCheck || slugToCheck.length < 3) return false;
    
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', slugToCheck)
      .maybeSingle();
    
    return !data && !error;
  }, []);

  // Verificar slug com debounce
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingSlug(true);
      try {
        const available = await checkSlugAvailability(slug);
        setSlugAvailable(available);
      } catch (err) {
        console.error('[Onboarding] Error checking slug:', err);
        setSlugAvailable(null);
      } finally {
        setCheckingSlug(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug, checkSlugAvailability]);

  // Verificar se já tem tenant (idempotente) - BLOQUEIA UI até completar
  useEffect(() => {
    async function checkExisting() {
      if (!user) return;

      try {
        setIsCheckingExisting(true);
        setCanProceed(false);
        console.log('[Onboarding] Checking existing tenant for user:', user.id);

        // Verificar se já é membro de algum tenant
        const { data: memberships, error } = await supabase
          .from('tenant_members')
          .select('tenant_id')
          .eq('user_id', user.id)
          .limit(1);

        if (error) {
          console.error('[Onboarding] Error checking memberships:', error);
          // Mesmo com erro, permitir prosseguir (fallback)
          setCanProceed(true);
          return;
        }

        if (memberships && memberships.length > 0) {
          console.log('[Onboarding] User already has tenant, redirecting to /app');
          navigate('/app', { replace: true });
          return; // Não define canProceed pois vai redirecionar
        }

        // Preencher nome do user se disponível
        const userMeta = user.user_metadata;
        if (userMeta?.full_name) {
          setFullName(userMeta.full_name);
        }

        // Verificação completa - liberar UI
        setCanProceed(true);

      } catch (err) {
        console.error('[Onboarding] Error in checkExisting:', err);
        setCanProceed(true); // Fallback: permitir prosseguir
      } finally {
        setIsCheckingExisting(false);
      }
    }

    if (!authLoading && user) {
      checkExisting();
    }
  }, [user, authLoading, navigate]);

  // Auto-gerar slug quando empresa muda
  useEffect(() => {
    if (!slugTouched && companyName) {
      setSlug(generateSlug(companyName));
    }
  }, [companyName, slugTouched]);

  // Validar Step 1 - agora inclui verificação de slug disponível
  const isStep1Valid = fullName.trim().length >= 2 && 
                       companyName.trim().length >= 2 && 
                       slug.trim().length >= 3 &&
                       slugAvailable === true &&
                       !checkingSlug;

  // Handler para criar tenant
  const handleCreateTenant = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    console.log('[Onboarding] Creating tenant...');

    try {
      // Verificação final de disponibilidade antes de criar
      const isStillAvailable = await checkSlugAvailability(slug);
      if (!isStillAvailable) {
        toast({
          title: 'Endereço indisponível',
          description: 'Este endereço foi registrado enquanto você preenchia o formulário. Por favor, escolha outro.',
          variant: 'destructive',
        });
        setSlugAvailable(false);
        setCurrentStep(1);
        setIsLoading(false);
        return;
      }

      const subdomain = `${slug}${SUBDOMAIN_SUFFIX}`;

      // 1. Atualizar profile (não crítico)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone || null,
          company_name: companyName,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) {
        console.error('[Onboarding] Profile error:', profileError);
      }

      // 2. Criar tenant e obter ID
      const { data: tenantData, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          name: companyName,
          slug: slug,
          owner_user_id: user.id,
          status: 'active',
        })
        .select('id')
        .single();

      if (tenantError || !tenantData) {
        console.error('[Onboarding] Tenant error:', tenantError);
        
        // Tratamento específico de erros
        if (tenantError?.code === '23505' || 
            tenantError?.message?.includes('duplicate') || 
            tenantError?.message?.includes('unique')) {
          toast({
            title: 'Endereço já em uso',
            description: 'Este endereço já está registrado. Por favor, escolha outro nome para sua empresa.',
            variant: 'destructive',
          });
          setSlugAvailable(false);
          setCurrentStep(1);
          setIsLoading(false);
          return;
        }
        
        if (tenantError?.message?.includes('row-level security') ||
            tenantError?.message?.includes('policy')) {
          throw new Error('Sua sessão expirou. Por favor, faça login novamente.');
        }
        
        throw new Error('Erro ao criar empresa. Tente novamente.');
      }

      const tenantId = tenantData.id;

      // 3. Criar membership como owner
      const { error: memberError } = await supabase
        .from('tenant_members')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) {
        console.error('[Onboarding] Member error:', memberError);
        throw new Error('Erro ao configurar permissões');
      }

      // 4. Criar blog e obter ID
      const { data: blogData, error: blogError } = await supabase
        .from('blogs')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          name: companyName,
          slug: slug,
          platform_subdomain: subdomain,
          onboarding_completed: true,
        })
        .select('id')
        .single();

      if (blogError || !blogData) {
        console.error('[Onboarding] Blog error:', blogError);
        throw new Error('Erro ao criar blog');
      }

      const blogId = blogData.id;

      // 5. Criar registro de domínio (não crítico)
      const { error: domainError } = await supabase
        .from('tenant_domains')
        .insert({
          tenant_id: tenantId,
          blog_id: blogId,
          domain: subdomain,
          domain_type: 'subdomain',
          status: 'pending',
          is_primary: true,
        });

      if (domainError) {
        console.error('[Onboarding] Domain error:', domainError);
      }

      // Sucesso!
      console.log('[Onboarding] Tenant created successfully:', tenantId);
      setCreatedTenantId(tenantId);
      setCreatedSubdomain(subdomain);
      setCurrentStep(3);

      toast({
        title: 'Empresa criada!',
        description: 'Sua conta está pronta para uso.',
      });

    } catch (err) {
      console.error('[Onboarding] Error creating tenant:', err);
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro ao criar empresa',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, fullName, phone, companyName, slug, checkSlugAvailability]);

  // Handlers de navegação
  const handleNext = () => {
    if (currentStep === 1 && isStep1Valid) {
      setCurrentStep(2);
      // Step 2 auto-executa criação
      handleCreateTenant();
    }
  };

  const handleBack = () => {
    if (currentStep > 1 && currentStep < 3) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleGoToDashboard = () => {
    navigate('/app', { replace: true });
  };

  // Loading states - BLOQUEIA UI até verificação completa
  if (authLoading || isCheckingExisting || !canProceed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          {isCheckingExisting ? 'Verificando sua conta...' : 'Carregando...'}
        </p>
      </div>
    );
  }

  // Progress calculation
  const progress = (currentStep / 3) * 100;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <OmniseenLogo size="sm" />
          <div className="text-sm text-muted-foreground">
            Etapa {currentStep} de 3
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1 w-full bg-secondary">
        <div 
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <Card className="w-full max-w-lg">
          {/* Step 1: Dados básicos */}
          {currentStep === 1 && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-display">Configure sua conta</CardTitle>
                <CardDescription>
                  Informe os dados da sua empresa para começar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Seu nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="João Silva"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone (opcional)</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="(11) 99999-9999"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companyName">Nome da empresa</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="companyName"
                        type="text"
                        placeholder="Minha Empresa"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slug">Endereço do seu blog</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="slug"
                        type="text"
                        placeholder="minha-empresa"
                        value={slug}
                        onChange={(e) => {
                          setSlug(generateSlug(e.target.value));
                          setSlugTouched(true);
                        }}
                        className="pl-10"
                      />
                      {/* Indicador de verificação de slug */}
                      {slug.length >= 3 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {checkingSlug ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : slugAvailable === true ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : slugAvailable === false ? (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          ) : null}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Seu blog ficará em: <span className="font-medium">{slug || 'minha-empresa'}{SUBDOMAIN_SUFFIX}</span>
                    </p>
                    {slugAvailable === false && (
                      <p className="text-xs text-destructive">
                        Este endereço já está em uso. Escolha outro.
                      </p>
                    )}
                  </div>
                </div>

                <Button 
                  onClick={handleNext} 
                  className="w-full gap-2" 
                  disabled={!isStep1Valid}
                >
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </>
          )}

          {/* Step 2: Criando */}
          {currentStep === 2 && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                </div>
                <CardTitle className="text-2xl font-display">Configurando sua conta...</CardTitle>
                <CardDescription>
                  Estamos preparando tudo para você
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                    <span>Criando empresa...</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Configurando blog...</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Provisionando subdomínio...</span>
                  </div>
                </div>

                <Button 
                  variant="outline" 
                  onClick={handleBack}
                  className="w-full gap-2"
                  disabled={isLoading}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
              </CardContent>
            </>
          )}

          {/* Step 3: Confirmação */}
          {currentStep === 3 && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-green-500" />
                </div>
                <CardTitle className="text-2xl font-display">Tudo pronto!</CardTitle>
                <CardDescription>
                  Sua conta foi configurada com sucesso
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Conta criada</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Empresa registrada: <strong>{companyName}</strong></span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm">Blog configurado</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <div className="text-sm">
                      Subdomínio provisionado: <br />
                      <code className="text-xs bg-background px-2 py-1 rounded">{createdSubdomain}</code>
                    </div>
                  </div>
                </div>

                <div className="bg-primary/5 rounded-lg p-4 space-y-2">
                  <h4 className="font-medium text-sm">📋 Próximos passos</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Personalize as cores e logo do seu blog</li>
                    <li>• Crie seu primeiro artigo com IA</li>
                    <li>• Configure seu domínio personalizado</li>
                  </ul>
                </div>

                <Button 
                  onClick={handleGoToDashboard} 
                  className="w-full gap-2"
                  size="lg"
                >
                  Ir para o Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
