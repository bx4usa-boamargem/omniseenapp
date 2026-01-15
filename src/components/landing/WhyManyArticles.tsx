import { useTranslation } from "react-i18next";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { FileText, Users, Zap, TrendingUp, Globe, Clock } from "lucide-react";

export const WhyManyArticles = () => {
  const { t } = useTranslation();
  const { ref, isVisible } = useScrollAnimation<HTMLElement>(0.1);

  const reasons = [
    {
      icon: FileText,
      title: t('landing.whyArticles.reason1.title'),
      desc: t('landing.whyArticles.reason1.desc'),
    },
    {
      icon: Users,
      title: t('landing.whyArticles.reason2.title'),
      desc: t('landing.whyArticles.reason2.desc'),
    },
    {
      icon: Zap,
      title: t('landing.whyArticles.reason3.title'),
      desc: t('landing.whyArticles.reason3.desc'),
    },
    {
      icon: TrendingUp,
      title: t('landing.whyArticles.reason4.title'),
      desc: t('landing.whyArticles.reason4.desc'),
    },
    {
      icon: Globe,
      title: t('landing.whyArticles.reason5.title'),
      desc: t('landing.whyArticles.reason5.desc'),
    },
    {
      icon: Clock,
      title: t('landing.whyArticles.reason6.title'),
      desc: t('landing.whyArticles.reason6.desc'),
    },
  ];

  return (
    <section ref={ref} className="py-20 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(var(--primary-rgb),0.05),transparent_50%)]" />
      
      <div className="container max-w-6xl relative z-10">
        {/* Header */}
        <div className={`text-center mb-12 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm font-semibold mb-4">
            <FileText className="h-4 w-4" />
            {t('landing.whyArticles.badge')}
          </div>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-4">
            {t('landing.whyArticles.title')}
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            {t('landing.whyArticles.subtitle')}
          </p>
        </div>

        {/* Comparison visual */}
        <div className={`grid md:grid-cols-2 gap-8 mb-16 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* Traditional approach */}
          <div className="bg-muted/50 rounded-2xl p-8 border border-border">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <span className="text-2xl">😔</span>
              </div>
              <div>
                <h3 className="font-bold text-lg">{t('landing.whyArticles.traditional.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('landing.whyArticles.traditional.subtitle')}</p>
              </div>
            </div>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-muted-foreground">
                <span className="text-red-500">✗</span>
                {t('landing.whyArticles.traditional.point1')}
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <span className="text-red-500">✗</span>
                {t('landing.whyArticles.traditional.point2')}
              </li>
              <li className="flex items-center gap-2 text-muted-foreground">
                <span className="text-red-500">✗</span>
                {t('landing.whyArticles.traditional.point3')}
              </li>
            </ul>
          </div>

          {/* Omniseen approach */}
          <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-8 border border-primary/20">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <span className="text-2xl">🚀</span>
              </div>
              <div>
                <h3 className="font-bold text-lg">{t('landing.whyArticles.omniseen.title')}</h3>
                <p className="text-sm text-primary">{t('landing.whyArticles.omniseen.subtitle')}</p>
              </div>
            </div>
            <ul className="space-y-3">
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span>
                {t('landing.whyArticles.omniseen.point1')}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span>
                {t('landing.whyArticles.omniseen.point2')}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-primary">✓</span>
                {t('landing.whyArticles.omniseen.point3')}
              </li>
            </ul>
          </div>
        </div>

        {/* Reasons grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {reasons.map((reason, index) => (
            <div
              key={index}
              className={`bg-card rounded-xl p-6 border hover:border-primary/30 shadow-sm transition-all duration-500 ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
              style={{ transitionDelay: `${300 + index * 100}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <reason.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold text-lg mb-2">{reason.title}</h3>
              <p className="text-muted-foreground text-sm">{reason.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
