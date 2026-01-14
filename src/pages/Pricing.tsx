import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useCaptureReferral, getStoredReferralCode } from "@/hooks/useReferral";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, ArrowLeft, Loader2, X, MapPin, Users, FileText, Target, Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Plan {
  id: string;
  name: string;
  tagline: string;
  description: string;
  price: {
    usd: { monthly: number; yearly: number };
    brl: { monthly: number; yearly: number };
  };
  features: Array<{ text: string; included: boolean; icon?: React.ReactNode }>;
  popular: boolean;
  cta: string;
}

const plans: Plan[] = [
  {
    id: 'lite',
    name: 'Lite',
    tagline: 'Existir no Digital',
    description: 'Para quem está começando a ser encontrado.',
    price: {
      usd: { monthly: 37, yearly: 25.90 },
      brl: { monthly: 187, yearly: 130.90 },
    },
    features: [
      { text: '1 blog automatizado', included: true, icon: <FileText className="h-4 w-4" /> },
      { text: 'Até 8 artigos por mês', included: true, icon: <FileText className="h-4 w-4" /> },
      { text: 'SEO automático', included: true, icon: <Target className="h-4 w-4" /> },
      { text: 'Calendário editorial', included: true, icon: <Zap className="h-4 w-4" /> },
      { text: 'Criação e publicação automática', included: true, icon: <Zap className="h-4 w-4" /> },
      { text: 'Acesso à plataforma', included: true, icon: <Zap className="h-4 w-4" /> },
      { text: '1 assento (1 pessoa na equipe)', included: true, icon: <Users className="h-4 w-4" /> },
      { text: '1 território', included: true, icon: <MapPin className="h-4 w-4" /> },
      { text: 'Radar de Oportunidades', included: false, icon: <Target className="h-4 w-4" /> },
    ],
    popular: false,
    cta: 'Começar agora',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Crescer com Inteligência',
    description: 'Para quem quer crescer guiado por dados reais.',
    price: {
      usd: { monthly: 97, yearly: 67.90 },
      brl: { monthly: 487, yearly: 340.90 },
    },
    features: [
      { text: '1 blog automatizado', included: true, icon: <FileText className="h-4 w-4" /> },
      { text: 'Até 20 artigos por mês', included: true, icon: <FileText className="h-4 w-4" /> },
      { text: 'SEO automático', included: true, icon: <Target className="h-4 w-4" /> },
      { text: 'Calendário editorial inteligente', included: true, icon: <Zap className="h-4 w-4" /> },
      { text: 'Criação e publicação automática', included: true, icon: <Zap className="h-4 w-4" /> },
      { text: 'Acesso completo à plataforma', included: true, icon: <Zap className="h-4 w-4" /> },
      { text: 'Até 5 assentos (5 pessoas na equipe)', included: true, icon: <Users className="h-4 w-4" /> },
      { text: 'Até 2 territórios', included: true, icon: <MapPin className="h-4 w-4" /> },
      { text: 'Radar: até 10 pesquisas/mês', included: true, icon: <Target className="h-4 w-4" /> },
    ],
    popular: true,
    cta: 'Ativar agora',
  },
  {
    id: 'business',
    name: 'Business',
    tagline: 'Dominar Território',
    description: 'Para quem quer ocupar mercado, não apenas aparecer.',
    price: {
      usd: { monthly: 147, yearly: 102.90 },
      brl: { monthly: 737, yearly: 515.90 },
    },
    features: [
      { text: 'Até 5 blogs automatizados', included: true, icon: <FileText className="h-4 w-4" /> },
      { text: 'Até 100 artigos por mês', included: true, icon: <FileText className="h-4 w-4" /> },
      { text: 'SEO em escala', included: true, icon: <Target className="h-4 w-4" /> },
      { text: 'Estratégia editorial automática', included: true, icon: <Zap className="h-4 w-4" /> },
      { text: 'Criação e publicação automática', included: true, icon: <Zap className="h-4 w-4" /> },
      { text: 'Acesso total à plataforma', included: true, icon: <Zap className="h-4 w-4" /> },
      { text: 'Até 20 assentos (20 pessoas na equipe)', included: true, icon: <Users className="h-4 w-4" /> },
      { text: 'Até 10 territórios', included: true, icon: <MapPin className="h-4 w-4" /> },
      { text: 'Radar: até 30 pesquisas/mês por blog', included: true, icon: <Target className="h-4 w-4" /> },
    ],
    popular: false,
    cta: 'Falar com especialista',
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [isYearly, setIsYearly] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Capture referral code from URL
  useCaptureReferral();

  const currency = useMemo(() => {
    return i18n.language === 'pt-BR' ? 'brl' : 'usd';
  }, [i18n.language]);

  const currencySymbol = currency === 'brl' ? 'R$' : '$';

  const formatPrice = (price: number): string => {
    if (currency === 'brl') {
      return price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return price.toFixed(2);
  };

  const getPrice = (plan: Plan): number => {
    return isYearly 
      ? plan.price[currency as 'usd' | 'brl'].yearly 
      : plan.price[currency as 'usd' | 'brl'].monthly;
  };

  const getOriginalMonthly = (plan: Plan): number => {
    return plan.price[currency as 'usd' | 'brl'].monthly;
  };

  const handleSelectPlan = async (planId: string) => {
    if (planId === 'business') {
      // Open contact for business plan
      window.open('https://wa.me/5511999999999?text=Quero%20saber%20mais%20sobre%20o%20plano%20Business', '_blank');
      return;
    }

    if (!user) {
      navigate(`/auth?plan=${planId}&period=${isYearly ? 'yearly' : 'monthly'}`);
      return;
    }

    setLoadingPlan(planId);

    try {
      const referralCode = getStoredReferralCode();

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          planId,
          billingPeriod: isYearly ? 'yearly' : 'monthly',
          userId: user.id,
          email: user.email,
          currency,
          successUrl: `${window.location.origin}/subscription?success=true`,
          cancelUrl: `${window.location.origin}/pricing?canceled=true`,
          referralCode,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else if (data?.error) {
        toast({
          title: "Erro",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o checkout.",
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg gradient-primary">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-xl">OMNISEEN</span>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-12">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-display font-bold mb-4">
            Domine seu <span className="gradient-text">território digital</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-2">
            Automatize seu blog. Seja encontrado no Google e no ChatGPT.
          </p>
          <p className="text-muted-foreground">
            Comece com 7 dias grátis. Cancele quando quiser.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span className={`text-sm font-medium ${!isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
              Mensal
            </span>
            <Switch checked={isYearly} onCheckedChange={setIsYearly} />
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
                Anual
              </span>
              <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                30% OFF
              </Badge>
            </div>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative flex flex-col transition-all ${plan.popular ? 'border-primary shadow-lg scale-105 z-10' : 'hover:border-primary/50'}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gradient-primary text-primary-foreground">
                    🔥 Mais popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-4 pt-8">
                <Badge variant="outline" className="w-fit mx-auto mb-2">
                  {plan.tagline}
                </Badge>
                <CardTitle className="text-2xl font-display">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="text-center mb-6">
                  {isYearly && (
                    <div className="text-muted-foreground line-through text-sm mb-1">
                      {currencySymbol}{formatPrice(getOriginalMonthly(plan))}/mês
                    </div>
                  )}
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-sm text-muted-foreground">{currencySymbol}</span>
                    <span className="text-4xl font-display font-bold">
                      {formatPrice(getPrice(plan))}
                    </span>
                    <span className="text-muted-foreground">/mês</span>
                  </div>
                  {isYearly && (
                    <p className="text-sm text-green-600 mt-1">
                      Economize 30%
                    </p>
                  )}
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      {feature.included ? (
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <span className={feature.included ? '' : 'text-muted-foreground line-through'}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button 
                  className={`w-full ${plan.popular ? 'gradient-primary text-primary-foreground' : ''}`}
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loadingPlan !== null}
                >
                  {loadingPlan === plan.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    plan.cta
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {/* Why so many articles - Explanatory Block */}
        <div className="mt-16 max-w-3xl mx-auto">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="pt-6">
              <h3 className="text-xl font-display font-bold mb-4 text-center">
                "Por que tantos artigos se só existem 30 dias no mês?"
              </h3>
              
              <div className="space-y-4 text-muted-foreground">
                <p>
                  Porque a Omniseen não funciona como um blog tradicional.
                </p>
                <p className="font-semibold text-foreground">
                  Você não publica "um post por dia". Você <span className="text-primary">ocupa território digital</span>.
                </p>
                <p>
                  Você pode publicar vários artigos no mesmo dia, sobre temas diferentes, 
                  baseados em dados reais do que está sendo falado em cada cidade ou território.
                </p>
                <div className="bg-background/50 rounded-lg p-4">
                  <p className="font-medium text-foreground mb-2">Nossa inteligência artificial:</p>
                  <ul className="space-y-1 ml-4">
                    <li>• Analisa buscas locais</li>
                    <li>• Identifica tendências</li>
                    <li>• Mapeia dúvidas reais das pessoas</li>
                    <li>• Cruza dados por nicho e região</li>
                  </ul>
                </div>
                <p>
                  Em muitos territórios, isso gera <strong className="text-foreground">10, 15, 30 ideias de artigos por dia</strong>.
                </p>
                <p>
                  Porque os artigos não são sobre sua empresa. 
                  <strong className="text-foreground"> Eles são sobre o que sua cidade está discutindo agora.</strong>
                </p>
                <p className="text-lg font-semibold text-foreground text-center pt-4">
                  É assim que você deixa de disputar atenção<br />
                  e <span className="text-primary">passa a dominar presença</span>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer message */}
        <div className="text-center mt-12">
          <p className="text-xl font-display font-semibold text-foreground mb-4">
            "Você não compra posts.<br />
            <span className="text-primary">Você ativa uma máquina de crescimento orgânico.</span>"
          </p>
          <p className="text-muted-foreground">
            Pagamento seguro via Stripe • Cancele a qualquer momento • Sem contratos longos
          </p>
        </div>
      </main>
    </div>
  );
}
