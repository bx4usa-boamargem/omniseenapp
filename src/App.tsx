// UNIFICADO: Usando apenas Sonner para evitar conflitos de DOM
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "react-error-boundary";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/contexts/TenantContext";
import { TenantGuard } from "@/components/auth/TenantGuard";
import { PlatformAdminGuard } from "@/components/auth/PlatformAdminGuard";
import { SubAccountGuard } from "@/components/auth/SubAccountGuard";
import { SubAccountLayout } from "@/components/layout/SubAccountLayout";
import { isPlatformHost, isSubaccountHost, isCustomDomainHost } from "@/utils/platformUrls";
import { BlogRoutes } from "@/routes/BlogRoutes";

// New Auth Pages
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";

// Legacy pages (to be migrated)
import Dashboard from "./pages/Dashboard";
import Articles from "./pages/Articles";
import NewArticle from "./pages/NewArticle";
import NewArticleChat from "./pages/NewArticleChat";
import EditArticle from "./pages/EditArticle";
import AutomationSettings from "./pages/AutomationSettings";
import PublicBlog from "./pages/PublicBlog";
import PublicArticle from "./pages/PublicArticle";
import PublicLandingPage from "./pages/PublicLandingPage";
import CustomDomainBlog from "./pages/CustomDomainBlog";
import CustomDomainArticle from "./pages/CustomDomainArticle";
import CustomDomainLandingPage from "./pages/CustomDomainLandingPage";
import Pricing from "./pages/Pricing";
import Subscription from "./pages/Subscription";
import Analytics from "./pages/Analytics";
import Clusters from "./pages/Clusters";
import Keywords from "./pages/Keywords";
import Settings from "./pages/Settings";
import Strategy from "./pages/Strategy";
import Calendar from "./pages/Calendar";
import Performance from "./pages/Performance";
import QueryDetails from "./pages/QueryDetails";
import Ebooks from "./pages/Ebooks";
import EbookDetails from "./pages/EbookDetails";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import PublicEbook from "./pages/PublicEbook";
import ClientReview from "./pages/ClientReview";
import Help from "./pages/Help";
import HelpArticle from "./pages/HelpArticle";
import Account from "./pages/Account";
import AccessDenied from "./pages/AccessDenied";
import AcceptInvite from "./pages/AcceptInvite";
import Profile from "./pages/Profile";
import MyBlog from "./pages/MyBlog";
import ValidationDashboard from "./pages/ValidationDashboard";
import Referrals from "./pages/Referrals";
import QuickAccess from "./pages/QuickAccess";
import ResetPassword from "./pages/ResetPassword";
import Blocked from "./pages/Blocked";
import TermsOfUse from "./pages/TermsOfUse";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Services from "./pages/Services";
import TermsOfUseEN from "./pages/en/TermsOfUseEN";
import PrivacyPolicyEN from "./pages/en/PrivacyPolicyEN";
import ServicesEN from "./pages/en/ServicesEN";
import Integrations from "./pages/Integrations";
import OAuthCallback from "./pages/auth/OAuthCallback";
import ArticleQueuePage from "./pages/ArticleQueuePage";

// Client (SubAccount) pages
import ClientDashboard from "./pages/client/ClientDashboard";
import ClientArticleEditor from "./pages/client/ClientArticleEditor";
import ClientSite from "./pages/client/ClientSite";
import ClientAutomation from "./pages/client/ClientAutomation";
import ClientCompany from "./pages/client/ClientCompany";
import ClientAccount from "./pages/client/ClientAccount";
import ClientProfile from "./pages/client/ClientProfile";
import ClientLandingPages from "./pages/client/ClientLandingPages";
import ClientLandingPageEditor from "./pages/client/ClientLandingPageEditor";
import ClientSEO from "./pages/client/ClientSEO";
import ClientArticles from "./pages/client/ClientArticles";
import ClientReviewCenter from "./pages/client/ClientReviewCenter";
import ClientStrategy from "./pages/client/ClientStrategy";
import ClientConsultantMetrics from "./pages/client/ClientConsultantMetrics";
import ClientNotificationSettings from "./pages/client/ClientNotificationSettings";
import ClientPosts from "./pages/client/ClientPosts";
import ClientTerritoryAnalytics from "./pages/client/ClientTerritoryAnalytics";
import ClientHelp from "./pages/client/ClientHelp";
import ClientHelpCategory from "./pages/client/ClientHelpCategory";
import ClientHelpArticle from "./pages/client/ClientHelpArticle";
import ClientHelpSearch from "./pages/client/ClientHelpSearch";
import ClientLeads from "./pages/client/ClientLeads";
import ClientEbooks from "./pages/client/ClientEbooks";
import ClientEbookEditor from "./pages/client/ClientEbookEditor";
import ClientDomains from "./pages/client/ClientDomains";
import ClientSettings from "./pages/client/ClientSettings";
import ArticleGenerator from "./pages/client/ArticleGenerator";
import ArticleAdvancedPreview from "./pages/client/ArticleAdvancedPreview";
import WordPressCallback from "./pages/cms/WordPressCallback";

const queryClient = new QueryClient();

// Redirect component for dynamic article routes
const ArticleEditRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/app/articles/${id}/edit`} replace />;
};

// Legacy blog redirects (avoid 404s on public content)
const BlogLegacyLandingPageRedirect = () => {
  const { blogSlug, pageSlug } = useParams();
  return <Navigate to={`/blog/${blogSlug}/p/${pageSlug}`} replace />;
};

const BlogLegacyArticleRedirect = () => {
  const { blogSlug, articleSlug } = useParams();
  return <Navigate to={`/blog/${blogSlug}/${articleSlug}`} replace />;
};

// Global Error Fallback - prevents white screen crashes
function GlobalErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-foreground mb-2">Algo deu errado</h1>
        <p className="text-muted-foreground mb-4">
          Ocorreu um erro inesperado. Tente recarregar a página.
        </p>
        <pre className="text-xs text-destructive bg-destructive/10 p-3 rounded-md mb-4 overflow-auto max-h-32">
          {error.message}
        </pre>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Recarregar Página
          </button>
          <button
            onClick={resetErrorBoundary}
            className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    </div>
  );
}

// Componente de fallback local para evitar desmontar o App inteiro
function PageErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
  return (
    <div className="p-6 border-2 border-destructive/20 bg-destructive/5 rounded-xl text-center">
      <h2 className="text-lg font-bold text-destructive mb-2">Erro de Renderização Local</h2>
      <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
      <Button onClick={resetErrorBoundary} variant="outline" size="sm">Tentar Recuperar Bloco</Button>
    </div>
  );
}

// User protected routes wrapper - uses TenantGuard
const UserRoutes = () => (
  <TenantGuard>
    <Routes>
      <Route index element={<Navigate to="/client/dashboard" replace />} />
      <Route path="dashboard" element={<Navigate to="/client/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/client/dashboard" replace />} />
    </Routes>
  </TenantGuard>
);

// Admin protected routes wrapper
const AdminRoutes = () => (
  <PlatformAdminGuard>
    <Routes>
      <Route index element={<Admin />} />
      <Route path="validation" element={<ValidationDashboard />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </PlatformAdminGuard>
);

// Client (SubAccount) routes wrapper
const ClientRoutes = () => (
  <SubAccountGuard>
    <SubAccountLayout>
      <ErrorBoundary 
        FallbackComponent={PageErrorFallback}
        onReset={() => {
          // Limpa estados que podem estar causando o conflito de DOM
          window.location.hash = '';
        }}
      >
        <Routes>
          <Route path="dashboard" element={<ClientDashboard />} />
          
          {/* Resultados & ROI */}
          <Route path="results" element={<ClientConsultantMetrics />} />
          <Route path="leads" element={<ClientLeads />} />
          
          {/* Inteligência */}
          <Route path="radar" element={<ClientStrategy />} />
          <Route path="seo" element={<ClientSEO />} />
          
          {/* Conteúdo */}
          <Route path="articles" element={<ClientArticles />} />
          <Route path="articles/generate" element={<ArticleGenerator />} />
          <Route path="articles/:id/preview" element={<ArticleAdvancedPreview />} />
          <Route path="portal" element={<ClientSite />} />
          <Route path="landing-pages" element={<ClientLandingPages />} />
          <Route 
            path="landing-pages/new" 
            element={<ClientLandingPageEditor key="lp-new" />} 
          />
          <Route 
            path="landing-pages/:id" 
            element={<ClientLandingPageEditor key="lp-edit" />} 
          />
          <Route path="create" element={<ClientArticleEditor />} />
          <Route path="articles/:id/edit" element={<ClientArticleEditor />} />
          <Route path="review/:id" element={<ClientReviewCenter />} />
          <Route path="ebooks" element={<ClientEbooks />} />
          <Route path="ebooks/:id" element={<ClientEbookEditor />} />
          
          {/* Operação */}
          <Route path="automation" element={<ClientAutomation />} />
          <Route path="profile" element={<ClientProfile />} />
          <Route path="company" element={<ClientCompany />} />
          <Route path="account" element={<ClientAccount />} />
          <Route path="territories" element={<ClientTerritoryAnalytics />} />
          <Route path="domains" element={<ClientDomains />} />
          <Route path="settings" element={<ClientSettings />} />
          
          {/* Ajuda */}
          <Route path="help" element={<ClientHelp />} />
          <Route path="help/category/:category" element={<ClientHelpCategory />} />
          <Route path="help/search" element={<ClientHelpSearch />} />
          <Route path="help/:slug" element={<ClientHelpArticle />} />
          
          {/* Legacy redirects para compatibilidade */}
          <Route path="posts" element={<Navigate to="/client/articles" replace />} />
          <Route path="site" element={<Navigate to="/client/portal" replace />} />
          <Route path="strategy" element={<Navigate to="/client/radar" replace />} />
          <Route path="consultant" element={<Navigate to="/client/results" replace />} />
          <Route path="performance" element={<Navigate to="/client/results?tab=performance" replace />} />
          <Route path="notifications" element={<Navigate to="/client/profile?tab=account" replace />} />
          <Route path="queue" element={<Navigate to="/client/automation?tab=queue" replace />} />
          <Route path="integrations/gsc" element={<Navigate to="/client/profile?tab=account" replace />} />
          
          <Route path="*" element={<Navigate to="/client/dashboard" replace />} />
        </Routes>
      </ErrorBoundary>
    </SubAccountLayout>
  </SubAccountGuard>
);

// Platform routes - for app.omniseen.app only
const PlatformRoutes = () => (
  <Routes>
    {/* Redirect root to login */}
    <Route path="/" element={<Navigate to="/login" replace />} />

    {/* New Auth routes */}
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />
    {/* /onboarding removido - auto-provisioning nos guards */}
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/blocked" element={<Blocked />} />
    <Route path="/access-denied" element={<AccessDenied />} />
    <Route path="/cms/wordpress-callback" element={<WordPressCallback />} />
    <Route path="/invite/accept" element={<AcceptInvite />} />
    <Route path="/oauth/callback" element={<OAuthCallback />} />

    {/* Legacy auth redirects */}
    <Route path="/auth" element={<Navigate to="/login" replace />} />
    <Route path="/forgot-password" element={<Navigate to="/reset-password" replace />} />
    <Route path="/oauth/google/callback" element={<Navigate to="/oauth/callback" replace />} />

    {/* Public content */}
    <Route path="/help" element={<Help />} />
    <Route path="/help/:slug" element={<HelpArticle />} />
    <Route path="/terms" element={<TermsOfUse />} />
    <Route path="/privacy" element={<PrivacyPolicy />} />
    <Route path="/services" element={<Services />} />
    <Route path="/servicos" element={<Navigate to="/services" replace />} />
    <Route path="/en/terms" element={<TermsOfUseEN />} />
    <Route path="/en/privacy" element={<PrivacyPolicyEN />} />
    <Route path="/en/services" element={<ServicesEN />} />
    <Route path="/pricing" element={<Pricing />} />
    <Route path="/ebook/:slug" element={<PublicEbook />} />
    <Route path="/review/:token" element={<ClientReview />} />

    {/*
      Public Super Pages (short URL)
      - Required for shared links like /p/:slug on app.omniseen.app
      - PublicLandingPage was updated to resolve blog via landing_pages.slug when blogSlug is absent
    */}
    <Route path="/p/:pageSlug/*" element={<PublicLandingPage />} />

    {/* Public blog + legacy redirects (never 404 for published URLs) */}
    <Route path="/blog/:blogSlug/page/:pageSlug" element={<BlogLegacyLandingPageRedirect />} />
    <Route path="/blog/:blogSlug/landing/:pageSlug" element={<BlogLegacyLandingPageRedirect />} />
    <Route path="/blog/:blogSlug/landing-pages/:pageSlug" element={<BlogLegacyLandingPageRedirect />} />
    <Route path="/blog/:blogSlug/post/:articleSlug" element={<BlogLegacyArticleRedirect />} />
    <Route path="/blog/:blogSlug/articles/:articleSlug" element={<BlogLegacyArticleRedirect />} />

    <Route path="/blog/:blogSlug/*" element={<PublicBlog />} />
    <Route path="/blog/:blogSlug/p/:pageSlug/*" element={<PublicLandingPage />} />
    <Route path="/blog/:blogSlug/:articleSlug/*" element={<PublicArticle />} />

    {/* Protected user routes - redirects to /client */}
    <Route path="/app/*" element={<UserRoutes />} />

    {/* Protected admin routes */}
    <Route path="/admin/*" element={<AdminRoutes />} />

    {/* SubAccount (Client) routes - main app experience */}
    <Route path="/client/*" element={<ClientRoutes />} />

    {/* Legacy redirects */}
    <Route path="/dashboard" element={<Navigate to="/client/dashboard" replace />} />
    <Route path="/articles" element={<Navigate to="/client/articles" replace />} />

    {/* Catch-all */}
    <Route path="*" element={<NotFound />} />
  </Routes>
);

/**
 * SubaccountRouteDecider: Para subdomínios {slug}.app.omniseen.app
 * 
 * ROTAS PRÓPRIAS DO SUBDOMÍNIO:
 * - Paths públicos (/, /:slug, /p/:slug) → BlogRoutes (sem auth)
 * - Paths /client/* → ClientRoutes diretamente (com SubAccountGuard)
 * - Paths de auth (/login, /signup) → Redireciona para app.omniseen.app
 * - Paths de admin (/admin) → Redireciona para app.omniseen.app/admin
 */
const SubaccountRouteDecider = () => {
  const pathname = window.location.pathname;
  
  console.log('[SubaccountRouteDecider] pathname:', pathname);
  
  // ROTAS PROTEGIDAS (/client/*) - renderiza ClientRoutes diretamente
  if (pathname.startsWith('/client')) {
    console.log('[SubaccountRouteDecider] → ClientRoutes');
    return <ClientRoutes />;
  }
  
  // ROTAS DE AUTH - redireciona para plataforma principal
  const authPaths = ['/login', '/signup', '/reset-password', '/blocked', '/access-denied'];
  if (authPaths.some(p => pathname.startsWith(p))) {
    const targetUrl = `https://app.omniseen.app${pathname}`;
    console.log('[SubaccountRouteDecider] → Redirect to platform:', targetUrl);
    window.location.href = targetUrl;
    return null;
  }
  
  // ROTAS DE OAUTH/INVITE - redireciona para plataforma principal
  if (pathname.startsWith('/oauth') || pathname.startsWith('/invite')) {
    const targetUrl = `https://app.omniseen.app${pathname}${window.location.search}`;
    console.log('[SubaccountRouteDecider] → Redirect to platform:', targetUrl);
    window.location.href = targetUrl;
    return null;
  }
  
  // ROTAS DE ADMIN - redireciona para plataforma principal
  if (pathname.startsWith('/admin') || pathname.startsWith('/app')) {
    window.location.href = `https://app.omniseen.app${pathname}`;
    return null;
  }
  
  // ROTAS PÚBLICAS (/, /:articleSlug, /p/:pageSlug) - BlogRoutes
  console.log('[SubaccountRouteDecider] → BlogRoutes (public)');
  return <BlogRoutes />;
};

/**
 * CustomDomainRouteDecider: Para domínios customizados (blog.cliente.com.br)
 * Sempre mostra o blog público
 */
const CustomDomainRouteDecider = () => {
  return <BlogRoutes />;
};

/**
 * AppRoutes: Componente principal que decide o modo da aplicação por hostname
 * 
 * REGRAS ABSOLUTAS:
 * - app.omniseen.app → PlatformRoutes (plataforma SaaS)
 * - {slug}.app.omniseen.app → SubaccountRouteDecider (blog + admin isolado)
 * - domínio customizado → CustomDomainRouteDecider (blog público apenas)
 * - Lovable preview/localhost → PlatformRoutes (dev mode)
 */
const AppRoutes = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname : 'ssr';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  
  // Debug logging detalhado para troubleshooting de roteamento
  console.log('[AppRoutes] Host detection:', {
    hostname: host,
    pathname,
    isSubaccount: isSubaccountHost(),
    isCustomDomain: isCustomDomainHost(),
    isPlatform: isPlatformHost()
  });

  if (isSubaccountHost()) {
    console.log('[AppRoutes] ✅ Subaccount host detected, using SubaccountRouteDecider');
    return <SubaccountRouteDecider />;
  }
  
  if (isCustomDomainHost()) {
    console.log('[AppRoutes] ✅ Custom domain host detected, using CustomDomainRouteDecider');
    return <CustomDomainRouteDecider />;
  }
  
  // Platform host (app.omniseen.app) or dev/preview
  console.log('[AppRoutes] ⚠️ Platform/dev host, using PlatformRoutes');
  return <PlatformRoutes />;
};

/**
 * Handler de reset do ErrorBoundary
 * REGRA: Subdomínios públicos NUNCA redirecionam para /login
 * - *.app.omniseen.app (blogs públicos) → reload
 * - Domínios customizados → reload
 * - app.omniseen.app (plataforma) → /login
 */
const handleErrorReset = () => {
  if (isSubaccountHost() || isCustomDomainHost()) {
    console.log('[ErrorBoundary] Public host detected, reloading instead of redirecting to login');
    window.location.reload();
    return;
  }
  window.location.href = '/login';
};

// Main App - with global ErrorBoundary for crash protection
const App = () => (
  <ErrorBoundary 
    FallbackComponent={GlobalErrorFallback}
    onReset={handleErrorReset}
    onError={(error) => console.error('[App] Global error caught:', error)}
  >
    <QueryClientProvider client={queryClient}>
      <ThemeProvider 
        attribute="class" 
        defaultTheme="system" 
        enableSystem
        disableTransitionOnChange
      >
        <AuthProvider>
          <TenantProvider>
            <TooltipProvider>
              {/* UNIFICADO: Usando apenas Sonner para evitar conflitos de DOM */}
              <Sonner />
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </TooltipProvider>
          </TenantProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;