import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { useHostRouting } from "@/hooks/useHostRouting";
import { UserGuard } from "@/components/auth/UserGuard";
import { PlatformAdminGuard } from "@/components/auth/PlatformAdminGuard";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Onboarding from "./pages/Onboarding";
import Articles from "./pages/Articles";
import NewArticle from "./pages/NewArticle";
import NewArticleChat from "./pages/NewArticleChat";
import EditArticle from "./pages/EditArticle";
import AutomationSettings from "./pages/AutomationSettings";
import PublicBlog from "./pages/PublicBlog";
import PublicArticle from "./pages/PublicArticle";
import CustomDomainBlog from "./pages/CustomDomainBlog";
import CustomDomainArticle from "./pages/CustomDomainArticle";
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
import LandingPageInternal from "./pages/LandingPageInternal";
import ResetPassword from "./pages/ResetPassword";
import Blocked from "./pages/Blocked";
import TermsOfUse from "./pages/TermsOfUse";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Integrations from "./pages/Integrations";
import GoogleIntegration from "./pages/GoogleIntegration";
import GoogleOAuthCallback from "./pages/GoogleOAuthCallback";
import ArticleQueuePage from "./pages/ArticleQueuePage";

const queryClient = new QueryClient();

// Redirect component for dynamic article routes
const ArticleEditRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/app/articles/${id}/edit`} replace />;
};

// Loading component while checking hostname
const HostnameLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// User protected routes wrapper
const UserRoutes = () => (
  <UserGuard>
    <Routes>
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="articles" element={<Articles />} />
      <Route path="articles/new" element={<NewArticle />} />
      <Route path="articles/new-chat" element={<NewArticleChat />} />
      <Route path="articles/:id/edit" element={<EditArticle />} />
      <Route path="ebooks" element={<Ebooks />} />
      <Route path="ebooks/:id" element={<EbookDetails />} />
      <Route path="strategy" element={<Strategy />} />
      <Route path="performance" element={<Performance />} />
      <Route path="performance/query/:queryId" element={<QueryDetails />} />
      <Route path="automation" element={<AutomationSettings />} />
      <Route path="keywords" element={<Keywords />} />
      <Route path="clusters" element={<Clusters />} />
      <Route path="calendar" element={<Calendar />} />
      <Route path="analytics" element={<Analytics />} />
      <Route path="my-blog" element={<MyBlog />} />
      <Route path="settings" element={<Settings />} />
      <Route path="account" element={<Account />} />
      <Route path="profile" element={<Profile />} />
      <Route path="referrals" element={<Referrals />} />
      <Route path="subscription" element={<Subscription />} />
      <Route path="quick-access" element={<QuickAccess />} />
      <Route path="landing" element={<LandingPageInternal />} />
      <Route path="integrations" element={<Integrations />} />
      <Route path="integrations/google" element={<GoogleIntegration />} />
      <Route path="articles/queue" element={<ArticleQueuePage />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </UserGuard>
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

// Component that renders appropriate routes based on domain access
const AppRoutes = () => {
  const { mode, loading, blogId, blogSlug } = useHostRouting();

  // Show loading while checking hostname
  if (loading) {
    return <HostnameLoader />;
  }

  // Blog mode - for verified custom domain blogs OR platform subdomain blogs
  if (mode === 'blog') {
    return (
      <Routes>
        <Route path="/" element={<CustomDomainBlog blogId={blogId} blogSlug={blogSlug} />} />
        <Route path="/:articleSlug" element={<CustomDomainArticle blogId={blogId} blogSlug={blogSlug} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  // Landing mode - public marketing site (omniseen.app)
  if (mode === 'landing') {
    return (
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<TermsOfUse />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/help" element={<Help />} />
        <Route path="/help/:slug" element={<HelpArticle />} />
        <Route path="/blog/:blogSlug" element={<PublicBlog />} />
        <Route path="/blog/:blogSlug/:articleSlug" element={<PublicArticle />} />
        <Route path="/ebook/:slug" element={<PublicEbook />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  // Platform mode - authenticated app (app.omniseen.app or localhost)
  return (
    <Routes>
      {/* Redirect root to dashboard */}
      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
      
      {/* Auth routes */}
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/blocked" element={<Blocked />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/access-denied" element={<AccessDenied />} />
      <Route path="/invite/accept" element={<AcceptInvite />} />
      <Route path="/oauth/google/callback" element={<GoogleOAuthCallback />} />
      
      {/* Public content (also accessible on platform) */}
      <Route path="/help" element={<Help />} />
      <Route path="/help/:slug" element={<HelpArticle />} />
      <Route path="/terms" element={<TermsOfUse />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/ebook/:slug" element={<PublicEbook />} />
      <Route path="/review/:token" element={<ClientReview />} />
      <Route path="/blog/:blogSlug" element={<PublicBlog />} />
      <Route path="/blog/:blogSlug/:articleSlug" element={<PublicArticle />} />

      {/* Protected user routes */}
      <Route path="/app/*" element={<UserRoutes />} />

      {/* Protected admin routes */}
      <Route path="/admin/*" element={<AdminRoutes />} />

      {/* Legacy redirects */}
      <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/articles" element={<Navigate to="/app/articles" replace />} />
      <Route path="/articles/new" element={<Navigate to="/app/articles/new" replace />} />
      <Route path="/articles/new-chat" element={<Navigate to="/app/articles/new-chat" replace />} />
      <Route path="/articles/:id/edit" element={<ArticleEditRedirect />} />
      <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
      <Route path="/quick-access" element={<Navigate to="/app/quick-access" replace />} />

      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
