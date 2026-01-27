import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete';

export interface SubscriptionData {
  id: string;
  user_id: string;
  plan: string;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  canceled_at: string | null;
  updated_at: string | null;
  is_internal_account?: boolean;
  account_type?: 'self_registered' | 'internal_team' | 'client_free' | 'client_paid';
  billing_required?: boolean;
}

export interface UseSubscriptionReturn {
  subscription: SubscriptionData | null;
  isActive: boolean;
  isTrial: boolean;
  isBlocked: boolean;
  isPastDue: boolean;
  daysUntilExpiry: number;
  daysRemainingTrial: number;
  loading: boolean;
  planDisplayName: string;
  refresh: () => Promise<void>;
}

// Map DB plan names to display names
const PLAN_DISPLAY_NAMES: Record<string, string> = {
  trial: 'Trial',
  trialing: 'Trial',
  essential: 'Starter',
  lite: 'Starter',
  starter: 'Starter',
  plus: 'Growth',
  pro: 'Growth',
  growth: 'Growth',
  scale: 'Scale',
  business: 'Scale',
  free: 'Trial',
  internal: 'Interno',
};

export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        setSubscription(null);
      } else {
        setSubscription(data as SubscriptionData | null);
      }
    } catch (error) {
      console.error('Error in fetchSubscription:', error);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Calculate status flags
  const status = subscription?.status;
  
  const isActive = status === 'active';
  const isTrial = status === 'trialing';
  const isPastDue = status === 'past_due';
  const isCanceled = status === 'canceled';
  const isUnpaid = status === 'unpaid';
  
  // Calcular isBlocked com regras de negócio corretas:
  // - active: acesso total
  // - trialing: acesso se trial_ends_at não expirou
  // - past_due: grace period de 3 dias baseado em updated_at
  // - canceled/unpaid/incomplete: bloqueio imediato
  // - sem subscription: NÃO bloquear imediatamente (fallback seguro)
  
  const calculateIsBlocked = (): boolean => {
    // Sem subscription = não bloquear (fallback para evitar derrubar o app)
    if (!subscription) {
      return false;
    }
    
    // If billing is not required (internal_team, client_free), never block
    if (subscription.billing_required === false) {
      return false;
    }
    
    // Internal accounts are never blocked (legacy check)
    if (subscription.plan === 'internal' || subscription.is_internal_account) {
      return false;
    }
    
    // account_type check for new system
    if (subscription.account_type === 'internal_team' || subscription.account_type === 'client_free') {
      return false;
    }
    
    // Active = sempre liberado
    if (status === 'active') {
      return false;
    }
    
    // Trialing = liberado se trial não expirou
    if (status === 'trialing') {
      if (subscription.trial_ends_at) {
        const trialEnd = new Date(subscription.trial_ends_at);
        return trialEnd < new Date(); // Bloqueia se expirou
      }
      return false; // Sem data de expiração = não bloquear
    }
    
    // Past due = grace period de 3 dias
    if (status === 'past_due') {
      if (subscription.updated_at) {
        const pastDueSince = new Date(subscription.updated_at);
        const gracePeriodEnd = new Date(pastDueSince.getTime() + 3 * 24 * 60 * 60 * 1000);
        return new Date() > gracePeriodEnd; // Bloqueia após 3 dias
      }
      return false; // Sem data = não bloquear ainda
    }
    
    // Canceled, unpaid, incomplete = bloqueio imediato
    if (status === 'canceled' || status === 'unpaid' || status === 'incomplete') {
      return true;
    }
    
    // Qualquer outro status desconhecido = não bloquear (segurança)
    return false;
  };
  
  const isBlocked = calculateIsBlocked();

  // Calculate days until expiry
  const daysUntilExpiry = subscription?.current_period_end
    ? Math.max(0, Math.ceil((new Date(subscription.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Calculate days remaining in trial
  const daysRemainingTrial = subscription?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(subscription.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Get display name for plan
  const planDisplayName = subscription?.plan 
    ? (PLAN_DISPLAY_NAMES[subscription.plan] || subscription.plan)
    : 'Sem plano';

  return {
    subscription,
    isActive,
    isTrial,
    isBlocked,
    isPastDue,
    daysUntilExpiry,
    daysRemainingTrial,
    loading,
    planDisplayName,
    refresh: fetchSubscription,
  };
}