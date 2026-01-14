import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { useLandingTrackingContext } from "@/hooks/useLandingTracking";
import { 
  Check, 
  FileText, 
  Globe, 
  Search, 
  User, 
  Users, 
  Palette, 
  Lightbulb, 
  Link, 
  BarChart, 
  Mail, 
  Image, 
  TrendingUp, 
  Share2, 
  Layers, 
  BookOpen, 
  Languages, 
  Target, 
  UserCheck, 
  Calendar, 
  Headphones,
  Code,
  Tag,
  Zap,
  Globe2,
  MessageSquare,
  Sparkles
} from "lucide-react";

const iconMap: Record<string, React.ReactNode> = {
  FileText: <FileText className="h-4 w-4" />,
  Globe: <Globe className="h-4 w-4" />,
  Search: <Search className="h-4 w-4" />,
  User: <User className="h-4 w-4" />,
  Users: <Users className="h-4 w-4" />,
  Palette: <Palette className="h-4 w-4" />,
  Lightbulb: <Lightbulb className="h-4 w-4" />,
  Link: <Link className="h-4 w-4" />,
  BarChart: <BarChart className="h-4 w-4" />,
  Mail: <Mail className="h-4 w-4" />,
  Image: <Image className="h-4 w-4" />,
  TrendingUp: <TrendingUp className="h-4 w-4" />,
  Share2: <Share2 className="h-4 w-4" />,
  Layers: <Layers className="h-4 w-4" />,
  BookOpen: <BookOpen className="h-4 w-4" />,
  Languages: <Languages className="h-4 w-4" />,
  Target: <Target className="h-4 w-4" />,
  UserCheck: <UserCheck className="h-4 w-4" />,
  Calendar: <Calendar className="h-4 w-4" />,
  Headphones: <Headphones className="h-4 w-4" />,
  Code: <Code className="h-4 w-4" />,
  Tag: <Tag className="h-4 w-4" />,
  Zap: <Zap className="h-4 w-4" />,
  Globe2: <Globe2 className="h-4 w-4" />,
  Check: <Check className="h-4 w-4" />,
  MessageSquare: <MessageSquare className="h-4 w-4" />,
  Sparkles: <Sparkles className="h-4 w-4" />,
};

interface PlanFeature {
  key: string;
  value: string | boolean;
  icon: string;
}

interface Plan {
  key: string;
  price: {
    usd: { monthly: number; yearly: number };
    brl: { monthly: number; yearly: number };
  };
  popular?: boolean;
  features: PlanFeature[];
}

// Updated plans according to new pricing structure - Starter $37, Growth $97, Pro $147
const plans: Plan[] = [
  {
    key: 'starter',
    price: {
      usd: { monthly: 37, yearly: 27.75 },
      brl: { monthly: 187, yearly: 140.25 },
    },
    features: [
      { key: 'cities', value: '1', icon: 'Globe' },
      { key: 'radarBasic', value: true, icon: 'Target' },
      { key: 'opportunities', value: '10/mês', icon: 'Lightbulb' },
      { key: 'autoArticles', value: true, icon: 'FileText' },
      { key: 'blogSubdomain', value: true, icon: 'Globe2' },
      { key: 'seoBasic', value: true, icon: 'Search' },
      { key: 'metricsBasic', value: true, icon: 'BarChart' },
      { key: 'trial', value: true, icon: 'Zap' },
    ],
  },
  {
    key: 'growth',
    price: {
      usd: { monthly: 97, yearly: 72.75 },
      brl: { monthly: 487, yearly: 365.25 },
    },
    popular: true,
    features: [
      { key: 'radarComplete', value: true, icon: 'Target' },
      { key: 'opportunities', value: '40/mês', icon: 'Lightbulb' },
      { key: 'seoOptimization', value: true, icon: 'TrendingUp' },
      { key: 'performanceAnalysis', value: true, icon: 'BarChart' },
      { key: 'oneClickSuggestions', value: true, icon: 'Sparkles' },
      { key: 'commercialMetrics', value: true, icon: 'Target' },
    ],
  },
  {
    key: 'pro',
    price: {
      usd: { monthly: 147, yearly: 110.25 },
      brl: { monthly: 737, yearly: 552.75 },
    },
    features: [
      { key: 'unlimitedOpportunities', value: true, icon: 'Zap' },
      { key: 'multipleCities', value: true, icon: 'Globe2' },
      { key: 'editorialStrategy', value: true, icon: 'Calendar' },
      { key: 'advancedSeo', value: true, icon: 'Search' },
      { key: 'batchOptimization', value: true, icon: 'Layers' },
      { key: 'trendIntelligence', value: true, icon: 'TrendingUp' },
      { key: 'earlyAccess', value: true, icon: 'Sparkles' },
    ],
  },
];

export function PricingTable() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { ref, isVisible } = useScrollAnimation();
  const [isYearly, setIsYearly] = useState(true);
  const tracking = useLandingTrackingContext();
  const hasTrackedView = useRef(false);

  // Track pricing section view
  useEffect(() => {
    if (isVisible && !hasTrackedView.current && tracking) {
      tracking.trackSectionView('pricing');
      hasTrackedView.current = true;
    }
  }, [isVisible, tracking]);

  // Detect currency based on language
  const currency = useMemo(() => {
    return i18n.language === 'pt-BR' ? 'brl' : 'usd';
  }, [i18n.language]);

  const currencySymbol = currency === 'brl' ? 'R$' : '$';

  const getFeatureLabel = (feature: PlanFeature): string => {
    const featureLabels: Record<string, string> = {
      articles: t('landing.pricing.features.articles', 'Artigos'),
      blogs: t('landing.pricing.features.blogs', 'Blogs automatizados'),
      keywords: t('landing.pricing.features.keywords', 'Palavras-chave'),
      teamMembers: t('landing.pricing.features.teamMembers', 'Membros da equipe'),
      brandedBlog: t('landing.pricing.features.brandedBlog', 'Blog com sua marca'),
      customDomain: t('landing.pricing.features.customDomain', 'Domínio personalizado'),
      smartSuggestions: t('landing.pricing.features.smartSuggestions', 'Sugestão inteligente de pautas'),
      internalLinking: t('landing.pricing.features.internalLinking', 'Linkagem interna/externa'),
      keywordAnalysis: t('landing.pricing.features.keywordAnalysis', 'Análise de palavras-chave'),
      weeklyReport: t('landing.pricing.features.weeklyReport', 'Relatório semanal'),
      aiImages: t('landing.pricing.features.aiImages', 'Imagens geradas por IA'),
      aiImagesLimited: t('landing.pricing.features.aiImagesLimited', 'Imagens IA (limitado)'),
      aiImagesExpanded: t('landing.pricing.features.aiImagesExpanded', 'Imagens IA (expandido)'),
      advancedSeo: t('landing.pricing.features.advancedSeo', 'SEO avançado'),
      socialIntegration: t('landing.pricing.features.socialIntegration', 'Integração redes sociais'),
      clusters: t('landing.pricing.features.clusters', 'Clusters de conteúdo'),
      clustersBasic: t('landing.pricing.features.clustersBasic', 'Clusters básicos'),
      clustersAdvanced: t('landing.pricing.features.clustersAdvanced', 'Clusters avançados'),
      ebooks: t('landing.pricing.features.ebooks', 'E-books automáticos'),
      autoTranslation: t('landing.pricing.features.autoTranslation', 'Tradução automática'),
      salesFunnel: t('landing.pricing.features.salesFunnel', 'Funil inteligente'),
      chatAI: t('landing.pricing.features.chatAI', 'Artigos com Bate-papo AI'),
      clientArea: t('landing.pricing.features.clientArea', 'Área de revisão para clientes'),
      editorialCalendar: t('landing.pricing.features.editorialCalendar', 'Calendário editorial'),
      apiAccess: t('landing.pricing.features.apiAccess', 'Acesso à API'),
      apiComingSoon: t('landing.pricing.features.apiComingSoon', 'API (em breve)'),
      whiteLabel: t('landing.pricing.features.whiteLabel', 'White label'),
      whiteLabelComingSoon: t('landing.pricing.features.whiteLabelComingSoon', 'White label (em breve)'),
      emailSupport: t('landing.pricing.features.emailSupport', 'Suporte por email'),
      prioritySupport: t('landing.pricing.features.prioritySupport', 'Suporte prioritário'),
      dedicatedManager: t('landing.pricing.features.dedicatedManager', 'Gerente dedicado'),
      contactSales: t('landing.pricing.features.contactSales', 'Precisa de mais blogs? Fale com vendas'),
      // New features for local search intelligence
      cities: t('landing.pricing.features.cities', 'cidade coberta'),
      radarBasic: t('landing.pricing.features.radarBasic', 'Radar de oportunidades (básico)'),
      radarComplete: t('landing.pricing.features.radarComplete', 'Radar completo de oportunidades'),
      opportunities: t('landing.pricing.features.opportunities', 'oportunidades de conteúdo'),
      autoArticles: t('landing.pricing.features.autoArticles', 'Criação automática de artigos'),
      blogSubdomain: t('landing.pricing.features.blogSubdomain', 'Blog em suaempresa.omniseen.app'),
      seoBasic: t('landing.pricing.features.seoBasic', 'SEO básico automático'),
      metricsBasic: t('landing.pricing.features.metricsBasic', 'Métricas essenciais'),
      trial: t('landing.pricing.features.trial', 'Trial de 7 dias incluído'),
      seoOptimization: t('landing.pricing.features.seoOptimization', 'Otimização de SEO em artigos'),
      performanceAnalysis: t('landing.pricing.features.performanceAnalysis', 'Análise de performance por artigo'),
      oneClickSuggestions: t('landing.pricing.features.oneClickSuggestions', 'Melhorias com 1 clique'),
      commercialMetrics: t('landing.pricing.features.commercialMetrics', 'Métricas de intenção comercial'),
      unlimitedOpportunities: t('landing.pricing.features.unlimitedOpportunities', 'Oportunidades ilimitadas'),
      multipleCities: t('landing.pricing.features.multipleCities', 'Múltiplas cidades'),
      editorialStrategy: t('landing.pricing.features.editorialStrategy', 'Estratégia editorial automatizada'),
      batchOptimization: t('landing.pricing.features.batchOptimization', 'Otimização em lote'),
      trendIntelligence: t('landing.pricing.features.trendIntelligence', 'Inteligência de tendências'),
      earlyAccess: t('landing.pricing.features.earlyAccess', 'Acesso antecipado a features'),
    };
    return featureLabels[feature.key] || feature.key;
  };

  const getPlanName = (key: string): string => {
    const names: Record<string, string> = {
      starter: 'Starter',
      growth: 'Growth',
      pro: 'Pro',
      lite: 'Lite',
      business: 'Business',
    };
    return names[key] || key;
  };

  const getPlanDescription = (key: string): string => {
    const planKey = key as 'starter' | 'growth' | 'pro' | 'lite' | 'business';
    const descriptions: Record<string, string> = {
      starter: t('landing.pricing.plans.starter.description', 'Para quem está começando a crescer organicamente'),
      growth: t('landing.pricing.plans.growth.description', 'Para negócios prontos para escalar'),
      pro: t('landing.pricing.plans.pro.description', 'Para quem quer dominar o mercado local'),
      lite: t('landing.pricing.plans.lite.description', 'Para novos blogueiros que estão começando'),
      business: t('landing.pricing.plans.business.description', 'Para equipes gerenciando vários sites'),
    };
    return descriptions[planKey] || '';
  };

  const formatPrice = (price: number): string => {
    if (currency === 'brl') {
      return price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toFixed(2);
  };

  const getMonthlyEquivalent = (plan: Plan): number => {
    const prices = plan.price[currency as 'usd' | 'brl'];
    return isYearly ? prices.yearly : prices.monthly;
  };

  const getOriginalMonthly = (plan: Plan): number => {
    return plan.price[currency as 'usd' | 'brl'].monthly;
  };

  const getSavingsPercent = (plan: Plan): number => {
    const monthly = plan.price[currency as 'usd' | 'brl'].monthly;
    const yearlyMonthly = plan.price[currency as 'usd' | 'brl'].yearly;
    return Math.round(((monthly - yearlyMonthly) / monthly) * 100);
  };

  return (
    <section 
      id="pricing" 
      ref={ref}
      className={`py-24 bg-background transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
    >
      <div className="container">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="secondary" className="mb-4">
            {t('landing.pricing.title', 'Preços')}
          </Badge>
          <h2 className="text-4xl md:text-5xl font-display font-bold mb-4">
            {t('landing.pricing.subtitle', 'Automatize seu blog. Obtenha mais tráfego do Google e do ChatGPT.')}
          </h2>
          <p className="text-muted-foreground text-lg">
            {t('landing.pricing.trialInfo', 'Comece com 7 dias grátis. Cancele quando quiser.')}
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm font-medium transition-colors ${!isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
            {t('landing.pricing.monthly', 'Mensal')}
          </span>
          <Switch 
            checked={isYearly} 
            onCheckedChange={setIsYearly}
            className="data-[state=checked]:bg-primary"
          />
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium transition-colors ${isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
              {t('landing.pricing.yearly', 'Anual')}
            </span>
            <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
              Economize 25%
            </Badge>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={plan.key}
              className={`relative flex flex-col transition-all duration-300 hover:shadow-lg ${
                plan.popular 
                  ? 'border-primary shadow-lg md:scale-105 z-10' 
                  : 'hover:border-primary/50'
              }`}
              style={{ 
                transitionDelay: `${index * 100}ms`,
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(20px)'
              }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gradient-primary text-primary-foreground shadow-md">
                    🔥 {t('landing.pricing.popular', 'Mais Popular')}
                  </Badge>
                </div>
              )}

              <CardHeader className="text-center pb-2 pt-8">
                <CardTitle className="text-2xl font-display">
                  {getPlanName(plan.key)}
                </CardTitle>
                <CardDescription className="text-sm">
                  {getPlanDescription(plan.key)}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                {/* Price */}
                <div className="text-center mb-6 py-4">
                  {isYearly && (
                    <div className="text-muted-foreground line-through text-sm mb-1">
                      {currencySymbol}{formatPrice(getOriginalMonthly(plan))}/{t('landing.pricing.perMonth', 'mês')}
                    </div>
                  )}
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-sm text-muted-foreground">{currencySymbol}</span>
                    <span className="text-4xl font-display font-bold text-foreground">
                      {formatPrice(getMonthlyEquivalent(plan))}
                    </span>
                    <span className="text-muted-foreground">/{t('landing.pricing.perMonth', 'mês')}</span>
                  </div>
                  {isYearly && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1 font-medium">
                      {t('landing.pricing.savePercent', 'Economize {{percent}}%', { percent: getSavingsPercent(plan) })}
                    </p>
                  )}
                  {isYearly && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('landing.pricing.billedYearly', 'Faturado anualmente')}
                    </p>
                  )}
                </div>

                {/* Previous plan inclusion */}
                {plan.key !== 'lite' && (
                  <div className="mb-4 p-3 rounded-lg bg-muted/50 text-center">
                    <span className="text-sm text-muted-foreground">
                      {t('landing.pricing.allFeaturesIn', 'Todos os recursos do')}{' '}
                      <span className="font-semibold text-foreground">
                        {plan.key === 'pro' ? 'Lite' : 'Pro'}
                      </span>
                      {' '}{t('landing.pricing.plus', 'mais:')}
                    </span>
                  </div>
                )}

                {/* Features */}
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-primary flex-shrink-0">
                        {iconMap[feature.icon] || <Check className="h-4 w-4" />}
                      </span>
                      <span className="text-foreground">
                        {typeof feature.value === 'string' 
                          ? `${feature.value} ${getFeatureLabel(feature)}`
                          : getFeatureLabel(feature)
                        }
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-4">
                <Button 
                  className={`w-full ${plan.popular ? 'gradient-primary text-primary-foreground shadow-md' : ''}`}
                  variant={plan.popular ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => {
                    tracking?.trackPlanSelect(getPlanName(plan.key), getMonthlyEquivalent(plan));
                    navigate(`/auth?plan=${plan.key}&period=${isYearly ? 'yearly' : 'monthly'}`);
                  }}
                >
                  {t('landing.pricing.startTrial', 'Começar Grátis')}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Trust badges */}
        <div className="text-center mt-12 text-muted-foreground">
          <p className="text-sm">
            {t('landing.pricing.trustBadges', 'Pagamento seguro via Stripe • Cancele a qualquer momento • Suporte dedicado')}
          </p>
        </div>
      </div>
    </section>
  );
}

// For backwards compatibility
export const PricingSection = PricingTable;