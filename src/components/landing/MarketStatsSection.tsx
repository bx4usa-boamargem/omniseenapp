import { useTranslation } from "react-i18next";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { useCountUp } from "@/hooks/useCountUp";
import { Search, Users, TrendingUp, Target } from "lucide-react";

interface StatCardProps {
  value: number;
  suffix: string;
  label: string;
  source: string;
  icon: React.ElementType;
  delay: number;
  isVisible: boolean;
}

const StatCard = ({ value, suffix, label, source, icon: Icon, delay, isVisible }: StatCardProps) => {
  const count = useCountUp(value, 2000 + delay, 0, isVisible);
  
  return (
    <div
      className={`relative bg-card rounded-2xl border p-6 md:p-8 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Icon */}
      <div className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      
      {/* Number */}
      <div className="mb-4">
        <span className="text-4xl md:text-5xl lg:text-6xl font-display font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          {count}
          {suffix}
        </span>
      </div>
      
      {/* Label */}
      <p className="text-foreground/90 text-base md:text-lg mb-3 leading-relaxed">
        {label}
      </p>
      
      {/* Source */}
      <p className="text-sm text-muted-foreground">
        Fonte: <span className="font-medium">{source}</span>
      </p>
    </div>
  );
};

export const MarketStatsSection = () => {
  const { t } = useTranslation();
  const { ref, isVisible } = useScrollAnimation<HTMLElement>(0.2);

  const stats = [
    {
      value: 53,
      suffix: '%',
      label: t('landing.marketStats.stats.organic.label'),
      source: t('landing.marketStats.stats.organic.source'),
      icon: Search,
    },
    {
      value: 67,
      suffix: '%',
      label: t('landing.marketStats.stats.leads.label'),
      source: t('landing.marketStats.stats.leads.source'),
      icon: Users,
    },
    {
      value: 3,
      suffix: 'x',
      label: t('landing.marketStats.stats.blog.label'),
      source: t('landing.marketStats.stats.blog.source'),
      icon: TrendingUp,
    },
    {
      value: 75,
      suffix: '%',
      label: t('landing.marketStats.stats.firstPage.label'),
      source: t('landing.marketStats.stats.firstPage.source'),
      icon: Target,
    },
  ];

  return (
    <section ref={ref} className="py-20 md:py-28 bg-muted/30 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent rounded-full blur-3xl" />
      </div>
      
      <div className="container max-w-6xl relative z-10">
        {/* Header */}
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold mb-6 leading-tight">
            {t('landing.marketStats.title')}
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto">
            {t('landing.marketStats.subtitle')}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <StatCard
              key={index}
              {...stat}
              delay={index * 150}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
