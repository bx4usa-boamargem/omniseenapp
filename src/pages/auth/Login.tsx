/**
 * Login Page - Nova implementação do zero
 * 
 * Características:
 * - Sem Radix/Portal nos componentes críticos
 * - ErrorBoundary para evitar tela branca
 * - Redirect sempre para /app após login
 * - Aguarda confirmação de sessão para evitar race condition
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from 'react-error-boundary';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { OmniseenLogo } from '@/components/ui/OmniseenLogo';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { Mail, Lock, ArrowRight, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';

// Error Boundary Fallback
function LoginErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border rounded-2xl p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Erro ao carregar login</h2>
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

export default function Login() {
  return (
    <ErrorBoundary 
      FallbackComponent={LoginErrorFallback}
      onReset={() => window.location.reload()}
    >
      <LoginContent />
    </ErrorBoundary>
  );
}

function LoginContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signIn, signInWithGoogle, loading: authLoading } = useAuth();
  const postLoginPath = '/client/dashboard';

  // Guard contra múltiplos redirects - previne race conditions
  const hasRedirectedRef = useRef(false);

  const safeRedirect = (path: string) => {
    if (hasRedirectedRef.current) {
      console.log('[Login] Redirect already in progress, skipping');
      return;
    }
    hasRedirectedRef.current = true;
    console.log('[Login] Safe redirect to:', path);
    navigate(path, { replace: true });
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAwaitingSession, setIsAwaitingSession] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [skipAuthLoading, setSkipAuthLoading] = useState(false);

  // Schema de validação
  const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  });

  // Debug logs
  useEffect(() => {
    console.log('[Login] Component mounted');
    console.log('[Login] authLoading:', authLoading, 'user:', user?.email);
  }, [authLoading, user]);

  // Pre-fill email from query string (when redirected from signup)
  useEffect(() => {
    const emailFromQuery = searchParams.get('email');
    if (emailFromQuery && !email) {
      setEmail(emailFromQuery);
    }
  }, [searchParams, email]);

  // Timeout para loading infinito
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (authLoading) {
      timer = setTimeout(() => {
        console.warn('[Login] Loading timeout exceeded');
        setLoadingTimeout(true);
      }, 15000);
    } else {
      setLoadingTimeout(false);
    }
    return () => clearTimeout(timer);
  }, [authLoading]);

  useEffect(() => {
    if (!isAwaitingSession || user) return;

    const timer = setTimeout(() => {
      console.warn('[Login] Session confirmation timeout exceeded');
      setIsAwaitingSession(false);
      toast({
        title: 'Sessão não confirmada',
        description: 'O backend demorou para confirmar seu acesso. Tente novamente em instantes.',
        variant: 'destructive',
      });
    }, 15000);

    return () => clearTimeout(timer);
  }, [isAwaitingSession, user]);

  // Auto-redirect se já está autenticado
  useEffect(() => {
    if (!authLoading && user) {
      console.log('[Login] User authenticated, redirecting to client dashboard');
      setIsAwaitingSession(false);
      safeRedirect(postLoginPath);
    }
  }, [authLoading, user, postLoginPath]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validation = loginSchema.safeParse({ email, password });
      if (!validation.success) {
        toast({
          title: 'Dados inválidos',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Login with 15s timeout
      const loginPromise = signIn(email, password);
      const timeoutPromise = new Promise<{ error: Error }>((_, reject) => 
        setTimeout(() => reject(new Error('TIMEOUT')), 15000)
      );

      let result: { error: Error | null };
      try {
        result = await Promise.race([loginPromise, timeoutPromise]) as { error: Error | null };
      } catch (timeoutErr: any) {
        if (timeoutErr?.message === 'TIMEOUT') {
          toast({
            title: 'Servidor demorou para responder',
            description: 'O login está demorando mais do que o esperado. Verifique sua conexão e tente novamente.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
        throw timeoutErr;
      }

      const { error } = result;

      if (error) {
        const message = error.message?.toLowerCase() || '';
        const isTimeoutOrNetworkError =
          message.includes('timeout') ||
          message.includes('network') ||
          message.includes('fetch') ||
          message.includes('failed to fetch');

        toast({
          title: isTimeoutOrNetworkError ? 'Backend indisponível' : 'Erro no login',
          description: isTimeoutOrNetworkError
            ? 'O servidor está demorando para responder. Tente novamente em alguns instantes.'
            : 'Email ou senha incorretos. Use "Esqueceu a senha?" para recuperar.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      toast({
        title: 'Credenciais confirmadas',
        description: 'Validando sua sessão e carregando sua conta...',
      });
      setIsAwaitingSession(true);

    } catch (err) {
      console.error('[Login] Unexpected error:', err);
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
      console.error('[Login] Google sign in error:', err);
      toast({
        title: 'Erro',
        description: 'Erro ao fazer login com Google',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Loading timeout fallback
  if (loadingTimeout) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4">
        <p className="text-muted-foreground">O carregamento está demorando mais que o esperado.</p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
          <Button variant="outline" onClick={() => { setLoadingTimeout(false); setSkipAuthLoading(true); }}>
            Voltar ao login
          </Button>
        </div>
      </div>
    );
  }

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
            {t('auth.branding.headline', 'Transforme seu blog em uma máquina de crescimento')}
          </h2>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            {t('auth.branding.subheadline', 'Crie conteúdo otimizado para SEO com inteligência artificial e aumente seu tráfego orgânico.')}
          </p>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-8 sm:p-8 min-h-screen lg:min-h-0">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <OmniseenLogo size="md" />
          </div>

          <Card className="border-0 shadow-none lg:shadow-xl lg:border">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-display">
                {t('auth.login.title', 'Entrar')}
              </CardTitle>
              <CardDescription>
                {t('auth.login.subtitle', 'Acesse sua conta para continuar')}
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

              {/* Email/Password Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t('auth.fields.password', 'Senha')}</Label>
                    <Link
                      to="/reset-password"
                      className="text-sm text-primary hover:underline"
                    >
                      {t('auth.login.forgotPassword', 'Esqueceu a senha?')}
                    </Link>
                  </div>
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
                </div>

                <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                  {isLoading || isAwaitingSession ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {t('auth.login.submit', 'Entrar')}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="text-center text-sm text-muted-foreground">
                {t('auth.login.noAccount', 'Não tem uma conta?')}{' '}
                <Link to="/signup" className="text-primary hover:underline font-medium">
                  {t('auth.login.signUp', 'Cadastre-se')}
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
