import { useTranslation } from "react-i18next";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { AlertTriangle, X, TrendingDown, BarChart3 } from "lucide-react";

export const ProblemSection = () => {
  const { t } = useTranslation();
  const { ref, isVisible } = useScrollAnimation<HTMLElement>(0.2);

  const problems = [
    {
      icon: X,
      text: t('landing.problemNew.point1'),
    },
    {
      icon: X,
      text: t('landing.problemNew.point2'),
    },
    {
      icon: X,
      text: t('landing.problemNew.point3'),
    },
    {
      icon: X,
      text: t('landing.problemNew.point4'),
    },
  ];

  return (
    <section ref={ref} className="py-20 bg-muted/30 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(45deg,transparent_45%,hsl(var(--destructive))_45%,hsl(var(--destructive))_55%,transparent_55%)] bg-[length:20px_20px]" />
      </div>
      
      <div className="container max-w-5xl relative z-10">
        {/* Header */}
        <div className={`text-center mb-12 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm font-semibold mb-4">
            <AlertTriangle className="h-4 w-4" />
            {t('landing.problemNew.badge')}
          </div>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4">
            {t('landing.problemNew.title')}
          </h2>
        </div>

        {/* Two column layout */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Problems list */}
          <div className="space-y-6">
            {problems.map((problem, index) => (
              <div
                key={index}
                className={`flex items-start gap-4 p-4 bg-card rounded-xl border border-destructive/20 transition-all duration-500 ${
                  isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
                }`}
                style={{ transitionDelay: `${200 + index * 100}ms` }}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <problem.icon className="h-5 w-5 text-destructive" />
                </div>
                <p className="text-lg text-foreground/90 pt-1.5">{problem.text}</p>
              </div>
            ))}
          </div>

          {/* Right: Impact statistic */}
          <div className={`transition-all duration-700 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-8 border border-primary/20">
              {/* Big stat */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center gap-3 mb-2">
                  <BarChart3 className="h-8 w-8 text-primary" />
                  <span className="text-5xl md:text-6xl font-display font-bold text-primary">50-60%</span>
                </div>
                <p className="text-xl text-foreground font-medium">
                  {t('landing.problemNew.statLabel')}
                </p>
              </div>

              {/* Divider */}
              <div className="border-t border-primary/20 my-6" />

              {/* Insight */}
              <div className="flex items-start gap-3">
                <TrendingDown className="h-6 w-6 text-destructive flex-shrink-0 mt-1" />
                <p className="text-muted-foreground">
                  {t('landing.problemNew.insight')}
                </p>
              </div>
            </div>

            {/* Conclusion */}
            <div className={`mt-6 p-4 bg-destructive/5 rounded-xl border border-destructive/10 transition-all duration-700 delay-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
              <p className="text-center text-lg font-medium text-foreground">
                {t('landing.problemNew.conclusion')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
