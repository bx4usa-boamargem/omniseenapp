import { CreditCard, CheckCircle, AlertTriangle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$14.97',
    period: '/mês',
    features: ['10 artigos/mês', '2 Super Páginas', 'Suporte por email'],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$39',
    period: '/mês',
    features: ['50 artigos/mês', '10 Super Páginas', 'Suporte prioritário', 'Automação'],
    popular: true,
  },
  {
    id: 'scale',
    name: 'Scale',
    price: '$79',
    period: '/mês',
    features: ['Artigos ilimitados', 'Super Páginas ilimitadas', 'Suporte VIP', 'API access'],
  },
];

export function BillingTab() {
  const { subscription, planDisplayName, loading } = useSubscription();

  const currentPlanId = subscription?.plan || 'trial';
  const status = subscription?.status || 'trialing';
  const trialEndsAt = subscription?.trial_ends_at;
  const displayName = planDisplayName;

  const getStatusBadge = () => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600"><CheckCircle className="h-3 w-3 mr-1" /> Ativo</Badge>;
      case 'trialing':
        return <Badge className="bg-blue-500/10 text-blue-600"><Calendar className="h-3 w-3 mr-1" /> Trial</Badge>;
      case 'past_due':
        return <Badge className="bg-yellow-500/10 text-yellow-600"><AlertTriangle className="h-3 w-3 mr-1" /> Pagamento pendente</Badge>;
      case 'canceled':
        return <Badge className="bg-red-500/10 text-red-600">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getDaysRemaining = () => {
    if (!trialEndsAt) return null;
    const endDate = new Date(trialEndsAt);
    const now = new Date();
    const diff = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const daysRemaining = getDaysRemaining();

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Seu Plano Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold">{displayName}</span>
                {getStatusBadge()}
              </div>
              {daysRemaining !== null && status === 'trialing' && (
                <p className="text-sm text-muted-foreground">
                  {daysRemaining} dias restantes no trial
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline">Ver histórico</Button>
              <Button>Atualizar plano</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <div>
        <h3 className="text-lg font-medium mb-4">Planos disponíveis</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === currentPlanId;
            return (
              <Card 
                key={plan.id} 
                className={cn(
                  "relative overflow-hidden transition-all",
                  plan.popular && "border-primary shadow-lg",
                  isCurrent && "bg-primary/5"
                )}
              >
                {plan.popular && (
                  <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg font-medium">
                    Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 mb-4">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    variant={isCurrent ? "outline" : "default"} 
                    className="w-full"
                    disabled={isCurrent}
                  >
                    {isCurrent ? 'Plano atual' : 'Selecionar'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Cancel Account */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Zona de perigo</CardTitle>
          <CardDescription>
            Ações irreversíveis para sua conta.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm">
            Cancelar conta
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
