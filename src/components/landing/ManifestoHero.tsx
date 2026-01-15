import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Sparkles, LogIn } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

export const ManifestoHero = () => {
  const { t } = useTranslation();
  const { ref, isVisible } = useScrollAnimation<HTMLElement>(0.1);

  const bullets = [
    t('landing.manifesto.bullet1'),
    t('landing.manifesto.bullet2'),
    t('landing.manifesto.bullet3'),
    t('landing.manifesto.bullet4'),
  ];

  return (
    <section 
      ref={ref}
      className="relative min-h-screen flex items-center pt-20 pb-16 overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      
      {/* Animated orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000" />

      <div className="container relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div 
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6 transition-all duration-700 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            {t('landing.manifesto.badge')}
          </div>

          {/* Main headline */}
          <h1 
            className={`text-4xl md:text-5xl lg:text-6xl font-display font-bold leading-tight mb-6 transition-all duration-700 delay-100 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {t('landing.manifesto.headline')}
          </h1>

          {/* Subheadline - emotional */}
          <p 
            className={`text-xl md:text-2xl text-muted-foreground mb-6 transition-all duration-700 delay-200 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {t('landing.manifesto.subheadline')}
          </p>

          {/* 5-second explanation box */}
          <div 
            className={`bg-primary/5 border border-primary/20 rounded-2xl p-6 mb-8 max-w-2xl mx-auto transition-all duration-700 delay-300 ${
              isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-95'
            }`}
          >
            <p className="text-lg md:text-xl font-medium text-foreground">
              {t('landing.manifesto.explanation')}
            </p>
          </div>

          {/* Bullets */}
          <div 
            className={`grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto mb-10 text-left transition-all duration-700 delay-400 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            {bullets.map((bullet, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                  <Check className="h-4 w-4 text-primary" />
                </div>
                <span className="text-foreground/80">{bullet}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div 
            className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-700 delay-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <Link to="/auth?mode=signup">
              <Button size="lg" className="text-lg px-8 py-6 font-semibold group">
                {t('landing.manifesto.ctaPrimary')}
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 font-semibold">
                <LogIn className="mr-2 h-5 w-5" />
                {t('landing.manifesto.ctaSecondary')}
              </Button>
            </Link>
          </div>

          {/* Trust badge */}
          <p 
            className={`mt-6 text-sm text-muted-foreground transition-all duration-700 delay-600 ${
              isVisible ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {t('landing.manifesto.trustBadge')}
          </p>
        </div>
      </div>
    </section>
  );
};
