import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocaleFormat } from "@/hooks/useLocaleFormat";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import {
  Sparkles,
  Bug,
  Scissors,
  Scale,
  Hammer,
  Stethoscope,
  Building2,
  MapPin,
  Target,
  Eye,
  TrendingUp,
  Rocket,
  DollarSign,
} from "lucide-react";

type NicheKey = 'limpeza' | 'pragas' | 'estetica' | 'advocacia' | 'construcao' | 'saude' | 'outro';

interface NicheData {
  searchesPerMonth: number;
  clickRate: number;
  icon: React.ElementType;
}

const nicheData: Record<NicheKey, NicheData> = {
  limpeza: { searchesPerMonth: 3200, clickRate: 0.15, icon: Sparkles },
  pragas: { searchesPerMonth: 2800, clickRate: 0.18, icon: Bug },
  estetica: { searchesPerMonth: 4500, clickRate: 0.12, icon: Scissors },
  advocacia: { searchesPerMonth: 1800, clickRate: 0.20, icon: Scale },
  construcao: { searchesPerMonth: 2400, clickRate: 0.14, icon: Hammer },
  saude: { searchesPerMonth: 5200, clickRate: 0.16, icon: Stethoscope },
  outro: { searchesPerMonth: 2500, clickRate: 0.15, icon: Building2 },
};

const conversionRates = [
  { value: 1, key: 'conservative' },
  { value: 3, key: 'medium' },
  { value: 5, key: 'aggressive' },
];

const EXCHANGE_RATE = 5.50;

// Counter animation component
const AnimatedCounter = ({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) => {
  const [displayValue, setDisplayValue] = useState(0);
  
  useEffect(() => {
    const duration = 800;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);
    
    return () => clearInterval(timer);
  }, [value]);
  
  return (
    <span className="tabular-nums">
      {prefix}{displayValue.toLocaleString()}{suffix}
    </span>
  );
};

export const TerritorialROICalculator = () => {
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useLocaleFormat();
  const { ref, isVisible } = useScrollAnimation();
  
  const [niche, setNiche] = useState<NicheKey>('limpeza');
  const [city, setCity] = useState('');
  const [averageTicket, setAverageTicket] = useState(400);
  const [conversionRate, setConversionRate] = useState(3);
  
  const isPortuguese = i18n.language === 'pt-BR';
  
  // Calculate ROI
  const calculations = useMemo(() => {
    const data = nicheData[niche];
    const organicVisits = Math.round(data.searchesPerMonth * data.clickRate);
    const leads = Math.round(organicVisits * (conversionRate / 100));
    const monthlyRevenue = leads * averageTicket;
    const annualRevenue = monthlyRevenue * 12;
    
    return {
      organicVisits,
      leads,
      monthlyRevenue,
      annualRevenue,
    };
  }, [niche, averageTicket, conversionRate]);
  
  // Format currency based on language
  const formatValue = (value: number) => {
    if (isPortuguese) {
      return formatCurrency(value, 'BRL');
    }
    return formatCurrency(value / EXCHANGE_RATE, 'USD');
  };
  
  const getTicketPlaceholder = () => isPortuguese ? 'R$ 400' : '$75';
  
  const nicheOptions: NicheKey[] = ['limpeza', 'pragas', 'estetica', 'advocacia', 'construcao', 'saude', 'outro'];
  
  return (
    <section 
      ref={ref}
      className="relative py-20 md:py-28 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--primary) / 0.03) 0%, hsl(var(--background)) 50%, hsl(var(--accent) / 0.05) 100%)'
      }}
    >
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>
      
      <div className="container relative z-10">
        {/* Header */}
        <div 
          className={`text-center mb-12 md:mb-16 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium mb-6">
            <DollarSign className="h-4 w-4" />
            <span>{t('landing.roiCalculator.badge')}</span>
          </div>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            {t('landing.roiCalculator.title')}
          </h2>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('landing.roiCalculator.subtitle')}
          </p>
        </div>
        
        {/* Calculator Grid */}
        <div 
          className={`grid lg:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto transition-all duration-700 delay-200 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* Configuration Panel */}
          <div className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 shadow-lg">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              {t('landing.roiCalculator.configuration')}
            </h3>
            
            <div className="space-y-6">
              {/* Niche Selector */}
              <div className="space-y-2">
                <Label htmlFor="niche">{t('landing.roiCalculator.niche')}</Label>
                <Select value={niche} onValueChange={(v) => setNiche(v as NicheKey)}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {nicheOptions.map((key) => {
                      const Icon = nicheData[key].icon;
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-primary" />
                            <span>{t(`landing.roiCalculator.niches.${key}`)}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              
              {/* City Input */}
              <div className="space-y-2">
                <Label htmlFor="city">{t('landing.roiCalculator.city')}</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder={t('landing.roiCalculator.cityPlaceholder')}
                    className="pl-10 bg-background"
                  />
                </div>
              </div>
              
              {/* Average Ticket */}
              <div className="space-y-2">
                <Label htmlFor="ticket">{t('landing.roiCalculator.averageTicket')}</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="ticket"
                    type="number"
                    min={10}
                    max={50000}
                    value={averageTicket}
                    onChange={(e) => setAverageTicket(Math.max(10, Number(e.target.value)))}
                    placeholder={getTicketPlaceholder()}
                    className="pl-10 bg-background"
                  />
                </div>
              </div>
              
              {/* Conversion Rate */}
              <div className="space-y-3">
                <Label>{t('landing.roiCalculator.conversionRate')}</Label>
                <RadioGroup
                  value={String(conversionRate)}
                  onValueChange={(v) => setConversionRate(Number(v))}
                  className="grid grid-cols-1 gap-2"
                >
                  {conversionRates.map((rate) => (
                    <div
                      key={rate.value}
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        conversionRate === rate.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setConversionRate(rate.value)}
                    >
                      <RadioGroupItem value={String(rate.value)} id={`rate-${rate.value}`} />
                      <Label htmlFor={`rate-${rate.value}`} className="cursor-pointer flex-1">
                        {t(`landing.roiCalculator.${rate.key}`)}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          </div>
          
          {/* Results Panel */}
          <div className="bg-card border border-border/50 rounded-2xl p-6 md:p-8 shadow-lg flex flex-col">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              {t('landing.roiCalculator.results')}
            </h3>
            
            {/* Context Tags */}
            <div className="flex flex-wrap gap-2 mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                <MapPin className="h-3.5 w-3.5" />
                {city || (isPortuguese ? 'Sua cidade' : 'Your city')}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent/10 text-accent-foreground text-sm rounded-full">
                {(() => {
                  const Icon = nicheData[niche].icon;
                  return <Icon className="h-3.5 w-3.5" />;
                })()}
                {t(`landing.roiCalculator.niches.${niche}`)}
              </span>
            </div>
            
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Organic Visits */}
              <div className="bg-background rounded-xl p-4 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <Eye className="h-4 w-4" />
                  <span>{t('landing.roiCalculator.visits')}</span>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-foreground">
                  <AnimatedCounter value={calculations.organicVisits} />
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ({t('landing.roiCalculator.estimated')})
                </p>
              </div>
              
              {/* Leads */}
              <div className="bg-background rounded-xl p-4 border border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                  <Target className="h-4 w-4" />
                  <span>{t('landing.roiCalculator.leads')}</span>
                </div>
                <p className="text-2xl md:text-3xl font-bold text-primary">
                  <AnimatedCounter value={calculations.leads} />
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ({t('landing.roiCalculator.opportunities')})
                </p>
              </div>
            </div>
            
            {/* Revenue Card - Highlighted */}
            <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 rounded-xl p-6 border border-primary/20 flex-1">
              <div className="absolute inset-0 rounded-xl animate-pulse opacity-30 bg-gradient-to-br from-primary/20 to-transparent" />
              
              <div className="relative">
                <div className="flex items-center gap-2 text-primary text-sm font-medium mb-3">
                  <DollarSign className="h-4 w-4" />
                  <span>{t('landing.roiCalculator.monthlyRevenue')}</span>
                </div>
                
                <p className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4">
                  {formatValue(calculations.monthlyRevenue)}
                </p>
                
                <div className="flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-sm">
                    {t('landing.roiCalculator.annualRevenue')}: <span className="font-semibold text-foreground">{formatValue(calculations.annualRevenue)}</span>
                  </span>
                </div>
              </div>
            </div>
            
            {/* Message */}
            <p className="text-sm text-muted-foreground mt-6 text-center italic">
              "{t('landing.roiCalculator.message')}"
            </p>
          </div>
        </div>
        
        {/* CTA Section */}
        <div 
          className={`text-center mt-12 transition-all duration-700 delay-400 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <Link to="/auth?mode=signup">
            <Button size="lg" className="text-lg px-8 py-6 shadow-lg hover:shadow-xl transition-all hover:scale-105 group">
              <Rocket className="mr-2 h-5 w-5 group-hover:animate-bounce" />
              {t('landing.roiCalculator.cta')}
            </Button>
          </Link>
          
          <p className="text-xs text-muted-foreground mt-4 max-w-md mx-auto">
            * {t('landing.roiCalculator.disclaimer')}
          </p>
        </div>
      </div>
    </section>
  );
};
