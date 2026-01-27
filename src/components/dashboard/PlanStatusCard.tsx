import { useNavigate } from 'react-router-dom';
import { CreditCard, AlertCircle, Crown, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { PLAN_TIERS } from '@/lib/metricsDefinitions';
import { cn } from '@/lib/utils';

export function PlanStatusCard() {
  const navigate = useNavigate();
  const { subscription, isTrial, isActive, isPastDue, isBlocked, daysRemainingTrial, planDisplayName, loading } =
    useSubscription();

  const handleUpgrade = () => {
    // Navigate to upgrade page or open modal
    navigate('/client/upgrade');
  };

  const handleCancel = () => {
    // Navigate to account settings for cancellation
    navigate('/client/profile?tab=billing');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Seu Plano
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = () => {
    if (isBlocked) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          Bloqueado
        </Badge>
      );
    }
    if (isPastDue) {
      return (
        <Badge variant="outline" className="border-yellow-500/50 text-yellow-600 dark:text-yellow-400 gap-1">
          <AlertCircle className="h-3 w-3" />
          Pagamento Pendente
        </Badge>
      );
    }
    if (isTrial) {
      return (
        <Badge variant="outline" className="border-primary/50 text-primary gap-1">
          <Crown className="h-3 w-3" />
          Trial
        </Badge>
      );
    }
    if (isActive) {
      return (
        <Badge variant="outline" className="border-green-500/50 text-green-600 dark:text-green-400">
          Ativo
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Inativo
      </Badge>
    );
  };

  const getPlanPrice = () => {
    const plan = subscription?.plan?.toLowerCase() || 'trial';
    const tier = PLAN_TIERS[plan as keyof typeof PLAN_TIERS];
    if (!tier) return null;
    if (tier.price === null) return tier.duration;
    return `$${tier.price}${tier.duration}`;
  };

  return (
    <Card className={cn(isBlocked && 'border-destructive/50', isPastDue && 'border-yellow-500/50')}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Seu Plano
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Info */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl font-bold text-foreground">{planDisplayName}</span>
              {getStatusBadge()}
            </div>
            {getPlanPrice() && <p className="text-sm text-muted-foreground">{getPlanPrice()}</p>}
          </div>
        </div>

        {/* Trial countdown */}
        {isTrial && daysRemainingTrial > 0 && (
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-primary font-medium">
              ⏰ {daysRemainingTrial} {daysRemainingTrial === 1 ? 'dia restante' : 'dias restantes'} no trial
            </p>
          </div>
        )}

        {/* Past due warning */}
        {isPastDue && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              ⚠️ Seu pagamento está pendente. Atualize seus dados de pagamento.
            </p>
          </div>
        )}

        {/* Blocked warning */}
        {isBlocked && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">
              🔒 Sua conta está bloqueada. Atualize seu plano para continuar.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button onClick={handleUpgrade} className="flex-1">
            Atualizar Plano
          </Button>
          <Button onClick={handleCancel} variant="outline" className="flex-1 text-muted-foreground">
            Cancelar Conta
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
