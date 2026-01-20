/**
 * Signup Page - Nova implementação do zero
 * 
 * Características:
 * - Sem Radix/Portal nos componentes críticos
 * - ErrorBoundary para evitar tela branca
 * - Redirect para /client/dashboard após signup (auto-provisioning nos guards)
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from 'react-error-boundary';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { OmniseenLogo } from '@/components/ui/OmniseenLogo';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Mail, Lock, User, ArrowRight, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';

// Error Boundary Fallback
function SignupErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Erro ao carregar cadastro</h2>
        <p className="text-sm text-muted-foreground">{error.message}</p>
        <div className="flex flex-col gap-3">
          <Button onClick={() => window.location.reload()} className="w-full">
            Recarregar página
          </Button>
          <Button variant="outline" onClick={resetErrorBoundary} className="w-full">
            Tentar novamente
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function Signup() {
  return (
    <ErrorBoundary 
      FallbackComponent={SignupErrorFallback}
      onReset={() => window.location.reload()}
    >
      <SignupContent />
    </ErrorBoundary>
  );
}

function SignupContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, signUp, signInWithGoogle, loading: authLoading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Schema de validação
  const signupSchema = z.object({
    fullName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  });

  // Debug logs
  useEffect(() => {
    console.log('[Signup] Component mounted');
    console.log('[Signup] authLoading:', authLoading, 'user:', user?.email);
  }, [authLoading, user]);

  // Redirect se já logado
  useEffect(() => {
    if (user && !authLoading) {
      console.log('[Signup] User already logged in, redirecting to /client/dashboard');
      navigate('/client/dashboard', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validation = signupSchema.safeParse({ fullName, email, password });
      if (!validation.success) {
        toast({
          title: 'Dados inválidos',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const { error } = await signUp(email, password, fullName);

      if (error) {
        // Verificar se é erro de email duplicado - redirecionar para login
        if (error.message.includes('already registered') || 
            error.message.includes('User already registered') ||
            error.message.includes('already exists')) {
          toast({
            title: 'Email já cadastrado',
            description: 'Redirecionando para o login...',
          });
          // Redirecionar para login com email preenchido
          navigate(`/login?email=${encodeURIComponent(email)}`);
          return;
        }
        
        toast({
          title: 'Erro',
          description: error.message || 'Erro ao criar conta',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Conta criada!',
        description: 'Configurando seu workspace...',
      });
      
      // Wait a moment for auth state to propagate before navigating
      // This ensures the session is established before TenantGuard runs
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Redirect para app (auto-provisioning nos guards)
      navigate('/client/dashboard', { replace: true });

    } catch (err) {
      console.error('[Signup] Unexpected error:', err);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro inesperado',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast({
          title: 'Erro',
          description: error.message || 'Erro ao fazer login com Google',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('[Signup] Google sign in error:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao fazer login com Google',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4 z-50">
        <LanguageSwitcher />
      </div>

      {/* Left side - Branding (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative z-10 flex flex-col justify-center px-12 text-primary-foreground">
          <div className="mb-8">
            <OmniseenLogo size="lg" className="brightness-0 invert" />
          </div>
          <h2 className="text-4xl lg:text-5xl font-display font-bold leading-tight mb-6">
            Comece seu blog de alta performance hoje
          </h2>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            Crie uma conta gratuita e transforme seu conteúdo em resultados reais.
          </p>
          
          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                ✨
              </div>
              <span>14 dias de trial gratuito</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                🚀
              </div>
              <span>Setup em menos de 5 minutos</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                📈
              </div>
              <span>Resultados desde o primeiro artigo</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Signup form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-8 sm:p-8 min-h-screen lg:min-h-0">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <OmniseenLogo size="md" />
          </div>

          <Card className="border-0 shadow-none lg:shadow-xl lg:border">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-display">
                {t('auth.signup.title', 'Criar conta')}
              </CardTitle>
              <CardDescription>
                {t('auth.signup.subtitle', 'Comece sua jornada de crescimento')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Google Sign In */}
              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                {t('auth.social.google', 'Continuar com Google')}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t('auth.social.or', 'ou')}
                  </span>
                </div>
              </div>

              {/* Signup Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('auth.fields.fullName', 'Nome completo')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Seu nome"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.fields.email', 'Email')}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.fields.password', 'Senha')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
                </div>

                <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {t('auth.signup.submit', 'Criar conta')}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <p className="text-xs text-center text-muted-foreground">
                Ao criar uma conta, você concorda com nossos{' '}
                <Link to="/terms" className="text-primary hover:underline">
                  Termos de Uso
                </Link>{' '}
                e{' '}
                <Link to="/privacy" className="text-primary hover:underline">
                  Política de Privacidade
                </Link>
              </p>

              <div className="text-center text-sm text-muted-foreground">
                {t('auth.signup.hasAccount', 'Já tem uma conta?')}{' '}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  {t('auth.signup.signIn', 'Entrar')}
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
