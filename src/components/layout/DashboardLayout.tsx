import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBlog } from "@/hooks/useBlog";
import { useSubscription } from "@/hooks/useSubscription";
import { Sidebar } from "./Sidebar";
import { NotificationBell } from "./NotificationBell";
import { TrialBanner } from "./TrialBanner";
import { PlanSelectionModal } from "@/components/subscription/PlanSelectionModal";
import { FloatingSupportChat } from "@/components/support/FloatingSupportChat";
import { Loader2, Menu, LayoutGrid } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, signOut } = useAuth();
  const { blog, loading: blogLoading, role } = useBlog();
  const { isTrial, daysRemainingTrial, isBlocked, refresh: refreshSubscription } = useSubscription();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showPlanModal, setShowPlanModal] = useState(false);

  // Check for subscription success/cancel from URL params
  useEffect(() => {
    const subscriptionStatus = searchParams.get('subscription');
    if (subscriptionStatus === 'success') {
      toast({
        title: "Assinatura ativada!",
        description: "Seu plano foi ativado com sucesso. Aproveite todos os recursos!",
      });
      // Refresh subscription status
      refreshSubscription();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (subscriptionStatus === 'canceled') {
      toast({
        title: "Checkout cancelado",
        description: "Você pode assinar a qualquer momento.",
        variant: "destructive",
      });
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [searchParams, refreshSubscription]);

  // Show mandatory modal when trial is expired (isBlocked = true)
  useEffect(() => {
    if (isBlocked) {
      setShowPlanModal(true);
    }
  }, [isBlocked]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!blogLoading && user && !blog) {
      navigate("/onboarding");
    } else if (!blogLoading && blog && blog.onboarding_completed === false) {
      navigate("/onboarding");
    }
  }, [blog, blogLoading, user, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleOpenPlanModal = () => {
    setShowPlanModal(true);
  };

  if (authLoading || blogLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !blog) {
    return null;
  }

  // Determine if user is in trial period (not expired)
  const isInActiveTrial = isTrial && !isBlocked;

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Desktop Sidebar - visible on lg (1024px+) */}
      <div className="hidden lg:flex">
        <Sidebar blogSlug={blog.slug} userRole={role} onSignOut={handleSignOut} />
      </div>

      {/* Mobile Header - visible below lg (< 1024px) */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between p-4">
          <span className="font-display font-bold text-lg">OMNISEEN</span>
          <div className="flex items-center gap-2">
            <Link to="/quick-access">
              <Button variant="ghost" size="icon">
                <LayoutGrid className="h-5 w-5" />
              </Button>
            </Link>
            <NotificationBell />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64">
                <Sidebar blogSlug={blog.slug} userRole={role} onSignOut={handleSignOut} />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Desktop Notification Bell - positioned in top right */}
      <div className="hidden lg:block fixed top-4 right-4 z-40">
        <NotificationBell />
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:pt-0 pt-16 overflow-auto flex flex-col">
        {/* Trial Banner - show only for users in active trial */}
        {isInActiveTrial && (
          <TrialBanner 
            daysRemaining={daysRemainingTrial} 
            onSubscribeClick={handleOpenPlanModal}
          />
        )}
        <div className="flex-1">
          {children}
        </div>
      </main>

      {/* Floating Support Chat */}
      <FloatingSupportChat />

      {/* Plan Selection Modal - mandatory when trial expired */}
      <PlanSelectionModal
        open={showPlanModal}
        onOpenChange={setShowPlanModal}
        canClose={!isBlocked}
        title={isBlocked ? "Seu período de teste terminou" : "Escolha seu plano"}
        description={isBlocked 
          ? "Para continuar usando a OMNISEEN, escolha um plano abaixo."
          : "Assine agora e aproveite todos os recursos"
        }
      />
    </div>
  );
}
