import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useCaptureReferral } from "@/hooks/useReferral";
import { useLandingTracking, LandingTrackingContext } from "@/hooks/useLandingTracking";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { OmniseenLogoHeader } from "@/components/ui/OmniseenLogoHeader";
import { TrackingScripts } from "@/components/analytics/TrackingScripts";
import { SalesAssistantChat } from "@/components/landing/SalesAssistantChat";
import { ManifestoHero } from "@/components/landing/ManifestoHero";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { MarketStatsSection } from "@/components/landing/MarketStatsSection";
import { AnimatedTimeline } from "@/components/landing/AnimatedTimeline";
import { WhyManyArticles } from "@/components/landing/WhyManyArticles";
import { FinalCTASection } from "@/components/landing/FinalCTASection";
import { PricingTable } from "@/components/landing/PricingTable";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ArrowRight, Loader2, Menu, LogIn } from "lucide-react";

export default function Index() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { trackPageView, trackSectionView, trackCTAClick, trackPlanSelect } = useLandingTracking();
  const hasTrackedPageView = useRef(false);

  useCaptureReferral();

  // Track page view on mount
  useEffect(() => {
    if (!hasTrackedPageView.current) {
      trackPageView();
      hasTrackedPageView.current = true;
    }
  }, [trackPageView]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen bg-background">
      <TrackingScripts />
      
      {/* Header - Login sempre visível */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border/40 h-[64px] md:h-[72px]">
        <div className="container h-full flex items-center justify-between">
          {/* Logo */}
          <Link to="/" onClick={scrollToTop}>
            <OmniseenLogoHeader />
          </Link>

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center gap-8">
            <button 
              onClick={scrollToTop}
              className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              {t('landing.header.home')}
            </button>
            <button 
              onClick={() => scrollToSection('how-it-works')}
              className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              {t('landing.header.howItWorks')}
            </button>
            <a 
              href="#pricing"
              className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              {t('landing.header.plans')}
            </a>
            <Link 
              to="/blog"
              className="text-sm font-medium text-foreground/80 hover:text-foreground transition-colors"
            >
              {t('landing.header.blog')}
            </Link>
          </nav>

          {/* Actions - Login SEMPRE visível */}
          <div className="flex items-center gap-2 md:gap-4">
            <LanguageSwitcher />
            
            {/* Login button - visível desktop E mobile */}
            <Link to="/auth">
              <Button variant="ghost" size="sm" className="font-medium">
                <LogIn className="h-4 w-4 mr-2" />
                Login
              </Button>
            </Link>
            
            {/* CTA - hidden on mobile */}
            <Link to="/auth?mode=signup" className="hidden sm:block">
              <Button size="sm">
                {t('landing.header.startFree')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px]">
                <div className="flex flex-col gap-6 mt-8">
                  <OmniseenLogoHeader />
                  <nav className="flex flex-col gap-4">
                    <button 
                      onClick={() => { scrollToTop(); closeMobileMenu(); }} 
                      className="text-left text-lg font-medium hover:text-primary transition-colors"
                    >
                      {t('landing.header.home')}
                    </button>
                    <button 
                      onClick={() => { scrollToSection('how-it-works'); closeMobileMenu(); }}
                      className="text-left text-lg font-medium hover:text-primary transition-colors"
                    >
                      {t('landing.header.howItWorks')}
                    </button>
                    <a 
                      href="#pricing" 
                      onClick={closeMobileMenu}
                      className="text-lg font-medium hover:text-primary transition-colors"
                    >
                      {t('landing.header.plans')}
                    </a>
                    <Link 
                      to="/blog" 
                      onClick={closeMobileMenu}
                      className="text-lg font-medium hover:text-primary transition-colors"
                    >
                      {t('landing.header.blog')}
                    </Link>
                  </nav>
                  <div className="flex flex-col gap-3 pt-4 border-t">
                    <Link to="/auth" onClick={closeMobileMenu}>
                      <Button variant="outline" className="w-full">
                        <LogIn className="h-4 w-4 mr-2" />
                        Login
                      </Button>
                    </Link>
                    <Link to="/auth?mode=signup" onClick={closeMobileMenu}>
                      <Button className="w-full">
                        {t('landing.header.startFree')}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main sections with tracking context */}
      <LandingTrackingContext.Provider value={{ trackSectionView, trackCTAClick, trackPlanSelect }}>
        {/* 1. Hero Manifesto */}
        <ManifestoHero />

        {/* 2. O Problema */}
        <ProblemSection />

        {/* 3. Estatísticas de Mercado - Prova Social com Dados */}
        <MarketStatsSection />

        {/* 4. Como Funciona - Timeline Animado */}
        <div id="how-it-works">
          <AnimatedTimeline />
        </div>

        {/* 5. Por Que Tantos Artigos */}
        <WhyManyArticles />

        {/* 6. Planos */}
        <PricingTable />

        {/* 7. CTA Final */}
        <FinalCTASection />
      </LandingTrackingContext.Provider>

      {/* Footer */}
      <footer className="py-12 bg-[#1a0a2e]">
        <div className="container">
          {/* Main row: Logo + Links + Copyright */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <OmniseenLogoHeader variant="light" />
            
            {/* Links */}
            <div className="flex gap-6 text-sm text-white/70">
              <a href="#pricing" className="hover:text-white transition-colors">
                {t('landing.header.plans')}
              </a>
              <Link to="/blog" className="hover:text-white transition-colors">
                {t('landing.header.blog')}
              </Link>
              <Link to="/auth" className="hover:text-white transition-colors font-medium">
                Login
              </Link>
            </div>
            
            {/* Copyright */}
            <p className="text-sm text-white/50">
              © {new Date().getFullYear()} OMNISEEN
            </p>
          </div>
          
          {/* Tagline */}
          <p className="text-center text-sm text-white/40 mt-6">
            {t('landing.footer.tagline')}
          </p>

          {/* Legal Links */}
          <div className="flex justify-center gap-4 text-xs text-white/40 mt-4">
            <Link to="/terms" className="hover:text-white/60 transition-colors">
              {t('auth.terms.termsOfUse')}
            </Link>
            <span>|</span>
            <Link to="/privacy" className="hover:text-white/60 transition-colors">
              {t('auth.terms.privacyPolicy')}
            </Link>
          </div>

          {/* All Rights Reserved */}
          <p className="text-center text-xs text-white/30 mt-2">
            {t('landing.footer.allRightsReserved')}
          </p>
        </div>
      </footer>

      {/* AI Sales Chat */}
      <SalesAssistantChat />
    </div>
  );
}
