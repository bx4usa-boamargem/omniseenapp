import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ErrorBoundary } from "react-error-boundary";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { OmniseenLogo } from "@/components/ui/OmniseenLogo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Mail, Lock, User, ArrowRight, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { z } from "zod";

// Error Boundary Fallback Component
function AuthErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
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
          <Button variant="outline" onClick={() => window.location.href = "/"} className="w-full">
            Voltar ao início
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Host: {window.location.hostname}
        </p>
      </div>
    </div>
  );
}

// Main Auth component wrapped with ErrorBoundary
export default function Auth() {
  return (
    <ErrorBoundary 
      FallbackComponent={AuthErrorFallback}
      onReset={() => window.location.reload()}
    >
      <AuthContent />
    </ErrorBoundary>
  );
}

const PLAN_NAMES: Record<string, string> = {
  lite: 'Lite',
  pro: 'Pro',
  business: 'Business',
};

function AuthContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signIn, signUp, signInWithGoogle, loading: authLoading } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({ email: "", password: "", fullName: "" });

  // Capture plan from URL
  const selectedPlan = searchParams.get('plan');
  const selectedPeriod = (searchParams.get('period') as 'monthly' | 'yearly') || 'yearly';

  const authSchema = z.object({
    email: z.string().email(t('auth.errors.invalidEmail')).max(255),
    password: z.string().min(6, t('auth.errors.passwordMin')).max(100),
    fullName: z.string().min(2, t('auth.errors.nameMin')).max(100).optional(),
  });

  // Debug logs for troubleshooting subdomain auth issues
  useEffect(() => {
    console.log('[Auth] Component mounted');
    console.log('[Auth] hostname:', window.location.hostname);
    console.log('[Auth] pathname:', window.location.pathname);
    console.log('[Auth] authLoading:', authLoading);
    console.log('[Auth] user:', user?.email || 'null');
  }, [authLoading, user]);

  // Timeout fallback to prevent infinite loading - reduced to 10 seconds
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (authLoading || isStartingTrial) {
      timer = setTimeout(() => {
        console.warn('[Auth] Loading timeout exceeded 10 seconds');
        setLoadingTimeout(true);
      }, 10000); // 10 seconds
    } else {
      setLoadingTimeout(false);
    }
    return () => clearTimeout(timer);
  }, [authLoading, isStartingTrial]);

  // State for already logged in user
  const [showAlreadyLoggedIn, setShowAlreadyLoggedIn] = useState(false);

  // Check if user is already logged in - show message instead of auto-redirect
  useEffect(() => {
    if (user && !isStartingTrial) {
      setShowAlreadyLoggedIn(true);
    } else {
      setShowAlreadyLoggedIn(false);
    }
  }, [user, isStartingTrial]);

  // Handle continue to dashboard for already logged in users
  const handleContinueToDashboard = async () => {
    if (!user) return;
    
    const currentHost = window.location.hostname;
    const isLandingDomain = currentHost === 'omniseen.app' || currentHost === 'www.omniseen.app';

    // If user has a plan selected, try to start trial
    if (selectedPlan && PLAN_NAMES[selectedPlan]) {
      setIsStartingTrial(true);
      try {
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id, status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!existingSub || (existingSub.status !== 'active' && existingSub.status !== 'trialing')) {
          await supabase.functions.invoke('start-trial', {
            body: { planId: selectedPlan, billingPeriod: selectedPeriod }
          });
        }
      } catch (error) {
        console.error('[Auth] Error in trial flow:', error);
      } finally {
        setIsStartingTrial(false);
      }
    }

    // Always redirect to /client/dashboard on current origin
    if (isLandingDomain) {
      window.location.href = 'https://app.omniseen.app/client/dashboard';
    } else {
      window.location.href = `${window.location.origin}/client/dashboard`;
    }
  };

  // State for redirect transition screen
  const [showRedirectScreen, setShowRedirectScreen] = useState(false);
  const [redirectFailed, setRedirectFailed] = useState(false);

  // Handle redirect after successful login/signup - ALWAYS go to /client/dashboard
  const handleSuccessfulAuth = async () => {
    const currentHost = window.location.hostname;
    const isLandingDomain = currentHost === 'omniseen.app' || currentHost === 'www.omniseen.app';

    // If user selected a plan, start trial
    if (selectedPlan && PLAN_NAMES[selectedPlan]) {
      setIsStartingTrial(true);
      try {
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('id, status')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .maybeSingle();

        if (!existingSub || (existingSub.status !== 'active' && existingSub.status !== 'trialing')) {
          await supabase.functions.invoke('start-trial', {
            body: { planId: selectedPlan, billingPeriod: selectedPeriod }
          });
        }
      } catch (error) {
        console.error('[Auth] Error in trial flow:', error);
      } finally {
        setIsStartingTrial(false);
      }
    }

    // Always redirect to /client/dashboard on current origin
    if (isLandingDomain) {
      setShowRedirectScreen(true);
      setTimeout(() => {
        window.location.href = 'https://app.omniseen.app/client/dashboard';
      }, 1500);
      setTimeout(() => setRedirectFailed(true), 6000);
    } else {
      window.location.href = `${window.location.origin}/client/dashboard`;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validation = authSchema.safeParse(loginData);
      if (!validation.success) {
        toast({
          title: t('auth.errors.validationError'),
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { error } = await signIn(loginData.email, loginData.password);
      
      if (error) {
        toast({
          title: t('common.error'),
          description: t('auth.errors.invalidLogin'),
          variant: "destructive",
        });
        setIsLoading(false);
      } else {
        toast({
          title: t('auth.login.welcomeBack'),
          description: t('auth.login.loginSuccess'),
        });
        // Redirect after successful login
        await handleSuccessfulAuth();
      }
    } catch {
      toast({
        title: t('common.error'),
        description: t('auth.errors.unexpectedError'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const validation = authSchema.safeParse(signupData);
      if (!validation.success) {
        toast({
          title: t('auth.errors.validationError'),
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const { error } = await signUp(signupData.email, signupData.password, signupData.fullName);
      
      if (error) {
        setIsLoading(false);
        let message = t('auth.errors.unexpectedError');
        if (error.message.includes("already registered") || error.message.includes("User already registered")) {
          message = "Este email já está cadastrado. Faça login ou use outro email.";
        }
        toast({
          title: t('common.error'),
          description: message,
          variant: "destructive",
        });
        return; // Stop here, don't proceed
      }
      
      toast({
        title: t('auth.signup.accountCreated'),
        description: t('auth.signup.welcomeMessage'),
      });
      // Redirect after successful signup
      await handleSuccessfulAuth();
    } catch {
      toast({
        title: t('common.error'),
        description: t('auth.errors.unexpectedError'),
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        toast({
          title: t('common.error'),
          description: t('auth.social.errorGoogle'),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t('common.error'),
        description: t('auth.social.errorGoogle'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loadingTimeout) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <p className="text-muted-foreground">O carregamento está demorando mais que o esperado.</p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
          <Button variant="outline" onClick={() => {
            setLoadingTimeout(false);
            setIsStartingTrial(false);
            setIsLoading(false);
          }}>Voltar ao login</Button>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show redirect transition screen
  if (showRedirectScreen) {
    const dashboardUrl = 'https://app.omniseen.app/client/dashboard';
    
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 p-4">
        <OmniseenLogo size="md" />
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">
              {redirectFailed ? t('auth.redirect.failed', 'Não foi possível abrir o painel') : t('auth.redirect.title', 'Abrindo o painel...')}
            </CardTitle>
            <CardDescription>
              {redirectFailed 
                ? t('auth.redirect.failedDescription', 'O redirecionamento não funcionou. Clique no botão abaixo para acessar.')
                : t('auth.redirect.description', 'Estamos te levando para o seu dashboard.')
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!redirectFailed && (
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <Button 
              className="w-full" 
              onClick={() => window.location.href = dashboardUrl}
            >
              {t('auth.redirect.openDashboard', 'Abrir Dashboard')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            {redirectFailed && (
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">{t('auth.redirect.copyLink', 'Ou copie o link:')}</p>
                <div className="flex items-center gap-2">
                  <Input value={dashboardUrl} readOnly className="text-xs" />
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(dashboardUrl);
                      toast({ title: t('auth.redirect.linkCopied', 'Link copiado!') });
                    }}
                  >
                    {t('common.copy', 'Copiar')}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show already logged in message
  if (showAlreadyLoggedIn && user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 p-4">
        <OmniseenLogo size="md" />
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">{t('auth.alreadyLoggedIn', 'Você já está logado')}</CardTitle>
            <CardDescription>
              {t('auth.loggedInAs', 'Logado como')} <span className="font-medium text-foreground">{user.email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleContinueToDashboard} 
              className="w-full"
            >
              {t('auth.continueToDashboard', 'Continuar para o Dashboard')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              onClick={async () => {
                await supabase.auth.signOut();
                setShowAlreadyLoggedIn(false);
              }}
              className="w-full"
            >
              {t('auth.signOut', 'Sair e usar outra conta')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-x-hidden">
      {/* Language Switcher - adjusted for mobile */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-50">
        <LanguageSwitcher />
      </div>

      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,255,255,0.1),transparent_50%)]" />
        
        <div className="relative z-10 flex flex-col justify-center px-12 text-primary-foreground">
          <div className="mb-8">
            <OmniseenLogo size="lg" className="brightness-0 invert" />
          </div>
          
          <h2 className="text-4xl lg:text-5xl font-display font-bold leading-tight mb-6">
            {t('auth.branding.headline')}
          </h2>
          
          <p className="text-lg text-primary-foreground/80 max-w-md">
            {t('auth.branding.subheadline')}
          </p>
          
          <div className="mt-12 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                ✨
              </div>
              <span>{t('auth.branding.feature1')}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                🎨
              </div>
              <span>{t('auth.branding.feature2')}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                📈
              </div>
              <span>{t('auth.branding.feature3')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-4 py-8 sm:p-8 min-h-screen lg:min-h-0">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center mb-6 sm:mb-8 pt-8 sm:pt-0">
            <OmniseenLogo size="md" />
          </div>

          <Card className="border-0 shadow-xl mx-auto">
            <CardHeader className="text-center pb-2 px-4 sm:px-6">
              {/* Show selected plan badge */}
              {selectedPlan && PLAN_NAMES[selectedPlan] && (
                <div className="flex justify-center mb-3 sm:mb-4">
                  <Badge variant="secondary" className="gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
                    {t('auth.selectedPlan', 'Plano selecionado')}: <span className="font-bold">{PLAN_NAMES[selectedPlan]}</span>
                  </Badge>
                </div>
              )}
              {!selectedPlan && (
                <div className="flex justify-center mb-3 sm:mb-4">
                  <Link to="/pricing">
                    <Badge variant="outline" className="gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm cursor-pointer hover:bg-muted">
                      {t('auth.noPlanSelected', 'Nenhum plano selecionado')} — {t('auth.choosePlan', 'Escolher plano')}
                    </Badge>
                  </Link>
                </div>
              )}
              <CardTitle className="text-xl sm:text-2xl font-display">{t('auth.login.title')}</CardTitle>
              <CardDescription className="text-sm">
                {t('auth.login.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-6 h-10 sm:h-11">
                  <TabsTrigger value="login" className="text-sm sm:text-base py-2">{t('auth.login.tabLogin')}</TabsTrigger>
                  <TabsTrigger value="signup" className="text-sm sm:text-base py-2">{t('auth.login.tabSignup')}</TabsTrigger>
                </TabsList>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email" className="text-sm sm:text-base">{t('auth.login.email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="seu@email.com"
                          className="pl-10 h-11 sm:h-10 text-base sm:text-sm"
                          value={loginData.email}
                          onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="login-password" className="text-sm sm:text-base">{t('auth.login.password')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="login-password"
                          type="password"
                          placeholder="••••••••"
                          className="pl-10 h-11 sm:h-10 text-base sm:text-sm"
                          value={loginData.password}
                          onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                          required
                        />
                      </div>
                      <div className="pt-1">
                        <a 
                          href="/reset-password" 
                          className="text-sm text-primary hover:underline font-medium inline-block py-1"
                        >
                          {t('auth.login.forgotPassword')}
                        </a>
                      </div>
                    </div>

                    <Button type="submit" className="w-full h-11 sm:h-10 text-base sm:text-sm" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {t('auth.login.submit')}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>

                    {/* Google OAuth Separator */}
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                          {t('auth.social.or')}
                        </span>
                      </div>
                    </div>

                    {/* Google Sign In Button */}
                    <Button 
                      type="button"
                      variant="outline" 
                      className="w-full h-11 sm:h-10 text-base sm:text-sm"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                    >
                      <svg className="mr-2 h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      {t('auth.social.continueWithGoogle')}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-sm sm:text-base">{t('auth.signup.fullName')}</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="Seu nome"
                          className="pl-10 h-11 sm:h-10 text-base sm:text-sm"
                          value={signupData.fullName}
                          onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-sm sm:text-base">{t('auth.login.email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="seu@email.com"
                          className="pl-10 h-11 sm:h-10 text-base sm:text-sm"
                          value={signupData.email}
                          onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-sm sm:text-base">{t('auth.login.password')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="Mínimo 6 caracteres"
                          className="pl-10 h-11 sm:h-10 text-base sm:text-sm"
                          value={signupData.password}
                          onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full h-11 sm:h-10 text-base sm:text-sm" disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {t('auth.signup.submit')}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>

                    {/* Google OAuth Separator */}
                    <div className="relative my-4">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                          {t('auth.social.or')}
                        </span>
                      </div>
                    </div>

                    {/* Google Sign Up Button */}
                    <Button 
                      type="button"
                      variant="outline" 
                      className="w-full h-11 sm:h-10 text-base sm:text-sm"
                      onClick={handleGoogleSignIn}
                      disabled={isLoading}
                    >
                      <svg className="mr-2 h-4 w-4 flex-shrink-0" viewBox="0 0 24 24">
                        <path
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          fill="#4285F4"
                        />
                        <path
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          fill="#34A853"
                        />
                        <path
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          fill="#FBBC05"
                        />
                        <path
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          fill="#EA4335"
                        />
                      </svg>
                      {t('auth.social.continueWithGoogle')}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <p className="text-center text-xs sm:text-sm text-muted-foreground mt-4 sm:mt-6 pb-4 sm:pb-0">
            {t('auth.terms.agreement')}{" "}
            <Link to="/terms" className="text-primary hover:underline">{t('auth.terms.termsOfUse')}</Link>
            {" "}{t('auth.terms.and')}{" "}
            <Link to="/privacy" className="text-primary hover:underline">{t('auth.terms.privacyPolicy')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
