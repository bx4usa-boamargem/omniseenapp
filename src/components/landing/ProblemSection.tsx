import { useTranslation } from "react-i18next";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { AlertTriangle, Clock, TrendingDown, XCircle } from "lucide-react";

export const ProblemSection = () => {
  const { t } = useTranslation();
  const { ref, isVisible } = useScrollAnimation<HTMLElement>(0.2);

  const problems = [
    { icon: Clock, text: t('landing.problem.line1') },
    { icon: AlertTriangle, text: t('landing.problem.line2') },
    { icon: TrendingDown, text: t('landing.problem.line3') },
  ];

  return (
    <section ref={ref} className="py-20 bg-muted/30 relative overflow-hidden">
      {/* Background visual - broken timeline */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-destructive/20 to-transparent" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-destructive/10 to-transparent" style={{ transform: 'rotate(2deg)' }} />
        <div className="absolute top-3/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-destructive/20 to-transparent" />
      </div>
      
      <div className="container max-w-4xl relative">
        <div className="text-center">
          {/* Main Title */}
          <h2 
            className={`text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-12 transition-all duration-700 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {t('landing.problem.title', 'O mercado já está falando. O problema é que você não está ouvindo.')}
          </h2>

          {/* Problem statements */}
          <div className="space-y-6 mb-12">
            {problems.map((problem, index) => (
              <div 
                key={index}
                className={`flex items-center justify-center gap-4 transition-all duration-700 ${
                  isVisible 
                    ? 'opacity-100 translate-x-0' 
                    : 'opacity-0 -translate-x-12'
                }`}
                style={{ transitionDelay: `${200 + index * 200}ms` }}
              >
                <div className={`p-2 rounded-lg bg-destructive/10 transition-all duration-500 ${isVisible ? 'scale-100' : 'scale-0'}`} style={{ transitionDelay: `${index * 200 + 300}ms` }}>
                  <problem.icon className="h-6 w-6 text-destructive/70" />
                </div>
                <p className="text-xl md:text-2xl text-muted-foreground font-medium">
                  {problem.text}
                </p>
              </div>
            ))}
          </div>
          
          {/* Conclusion */}
          <div 
            className={`transition-all duration-700 ${
              isVisible 
                ? 'opacity-100 translate-y-0 scale-100' 
                : 'opacity-0 translate-y-8 scale-95'
            }`}
            style={{ transitionDelay: '900ms' }}
          >
            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-destructive/10 border border-destructive/20 hover-glow" style={{ '--tw-shadow-color': 'hsl(var(--destructive) / 0.3)' } as React.CSSProperties}>
              <XCircle className="h-8 w-8 text-destructive animate-pulse" />
              <p className="text-2xl md:text-3xl font-display font-bold text-destructive">
                {t('landing.problem.conclusion')}
              </p>
            </div>
          </div>
          
          {/* Visual: abandoned blog chart */}
          <div 
            className={`mt-12 transition-all duration-1000 ${
              isVisible 
                ? 'opacity-100 scale-100' 
                : 'opacity-0 scale-90'
            }`}
            style={{ transitionDelay: '1100ms' }}
          >
            <div className="relative mx-auto max-w-md">
              {/* Animated declining chart */}
              <svg viewBox="0 0 200 80" className="w-full h-24 text-destructive/30">
                <defs>
                  <linearGradient id="declineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(var(--warning))" />
                    <stop offset="100%" stopColor="hsl(var(--destructive))" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0 20 Q 30 15 50 25 T 100 40 T 150 60 T 200 75"
                  fill="none"
                  stroke="url(#declineGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className={`transition-all duration-1500 ${isVisible ? 'opacity-60' : 'opacity-0'}`}
                  style={{ 
                    strokeDasharray: 283,
                    strokeDashoffset: isVisible ? 0 : 283,
                    transition: 'stroke-dashoffset 1.5s ease-out 1.3s'
                  }}
                />
                <circle 
                  cx="200" 
                  cy="75" 
                  r="4" 
                  fill="hsl(var(--destructive))" 
                  className={`transition-all duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
                  style={{ transitionDelay: '2.8s' }}
                />
              </svg>
              <p className={`text-sm text-muted-foreground mt-2 transition-all duration-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`} style={{ transitionDelay: '1.5s' }}>
                {t('landing.problem.chartLabel')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
