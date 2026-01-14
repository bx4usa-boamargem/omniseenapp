import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getStoredReferralCode } from "@/hooks/useReferral";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Plan {
  id: string;
  name: string;
  description: string;
  price: {
    usd: { monthly: number; yearly: number };
    brl: { monthly: number; yearly: number };
  };
  features: string[];
  popular: boolean;
}

const plans: Plan[] = [
  {
    id: 'lite',
    name: 'Lite',
    description: 'Existir no Digital',
    price: {
      usd: { monthly: 37, yearly: 25.90 },
      brl: { monthly: 187, yearly: 130.90 },
    },
    features: [
      '1 blog automatizado',
      'Até 8 artigos/mês',
      '1 território',
      '1 assento',
      'SEO automático',
    ],
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Crescer com Inteligência',
    price: {
      usd: { monthly: 97, yearly: 67.90 },
      brl: { monthly: 487, yearly: 340.90 },
    },
    features: [
      '1 blog automatizado',
      'Até 20 artigos/mês',
      'Até 2 territórios',
      'Até 5 assentos',
      'Radar: 10 pesquisas/mês',
    ],
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Dominar Território',
    price: {
      usd: { monthly: 147, yearly: 102.90 },
      brl: { monthly: 737, yearly: 515.90 },
    },
    features: [
      'Até 5 blogs',
      'Até 100 artigos/mês',
      'Até 10 territórios',
      'Até 20 assentos',
      'Radar: 30 pesquisas/blog',
    ],
    popular: false,
  },
];

interface PlanSelectionModalProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  canClose?: boolean;
  title?: string;
  description?: string;
}

export function PlanSelectionModal({
  open,
  onOpenChange,
  canClose = true,
  title = "Escolha seu plano",
  description = "Selecione o plano ideal para suas necessidades",
}: PlanSelectionModalProps) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [isYearly, setIsYearly] = useState(true);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

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

  const handleSelectPlan = async (planId: string) => {
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para assinar um plano.",
        variant: "destructive",
      });
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
          successUrl: `${window.location.origin}/app/dashboard?subscription=success`,
          cancelUrl: `${window.location.origin}/app/dashboard?subscription=canceled`,
          referralCode,
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Open Stripe checkout in new tab
        window.open(data.url, '_blank');
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
        description: "Não foi possível iniciar o checkout. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    // If canClose is false, don't allow closing
    if (!canClose && !newOpen) {
      return;
    }
    onOpenChange?.(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          if (!canClose) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (!canClose) {
            e.preventDefault();
          }
        }}
        // Hide close button if canClose is false
        hideCloseButton={!canClose}
      >
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-display">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 py-4">
          <span className={`text-sm font-medium ${!isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
            Mensal
          </span>
          <Switch checked={isYearly} onCheckedChange={setIsYearly} />
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
              Anual
            </span>
            <Badge variant="secondary" className="bg-green-500/10 text-green-600">
              -25%
            </Badge>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative flex flex-col transition-all ${plan.popular ? 'border-primary shadow-lg' : 'hover:border-primary/50'}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gradient-primary text-primary-foreground text-xs">
                    🔥 Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader className="text-center pb-2 pt-6">
                <CardTitle className="text-lg font-display">{plan.name}</CardTitle>
                <CardDescription className="text-xs">{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 py-2">
                <div className="text-center mb-4">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-xs text-muted-foreground">{currencySymbol}</span>
                    <span className="text-2xl font-display font-bold">
                      {formatPrice(getPrice(plan))}
                    </span>
                    <span className="text-xs text-muted-foreground">/mês</span>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <Check className="h-3 w-3 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-2">
                <Button 
                  className={`w-full ${plan.popular ? 'gradient-primary text-primary-foreground' : ''}`}
                  variant={plan.popular ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={loadingPlan !== null}
                >
                  {loadingPlan === plan.id ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                      Abrindo...
                    </>
                  ) : (
                    'Assinar'
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Pagamento seguro via Stripe • Cancele quando quiser
        </p>
      </DialogContent>
    </Dialog>
  );
}