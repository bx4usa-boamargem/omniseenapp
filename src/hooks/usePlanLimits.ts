import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export type ResourceType = 'articles' | 'images' | 'keywords' | 'ebooks' | 'blogs' | 'team_members' | 'territories' | 'radar';

interface LimitCheckResult {
  canCreate: boolean;
  remaining: number;
  limit: number;
  used: number;
  isUnlimited: boolean;
  plan: string;
}

interface PlanLimits {
  articles_limit: number;
  images_limit: number;
  keywords_limit: number;
  ebooks_limit: number;
  blogs_limit: number;
  team_members_limit: number;
  territories_limit: number;
  radar_limit: number;
}

interface PlanUsage {
  articles_used: number;
  images_used: number;
  keywords_used: number;
  ebooks_used: number;
  blogs_used: number;
  team_members_used: number;
  territories_used: number;
  radar_used: number;
}

export function usePlanLimits() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [usage, setUsage] = useState<PlanUsage | null>(null);
  const [plan, setPlan] = useState<string>('free');

  const checkLimit = useCallback(async (resource: ResourceType): Promise<LimitCheckResult> => {
    if (!user) {
      return {
        canCreate: false,
        remaining: 0,
        limit: 0,
        used: 0,
        isUnlimited: false,
        plan: 'free',
      };
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-limits', {
        body: { 
          userId: user.id, 
          action: 'check', 
          resource 
        }
      });

      if (error) throw error;

      setLimits(data.limits);
      setUsage(data.usage);
      setPlan(data.plan);

      const limitKey = `${resource}_limit` as keyof PlanLimits;
      const usageKey = `${resource}_used` as keyof PlanUsage;
      
      const resourceLimit = data.limits[limitKey] ?? 0;
      const resourceUsed = data.usage[usageKey] ?? 0;
      const isUnlimited = resourceLimit === -1;

      return {
        canCreate: !data.limitReached,
        remaining: data.remaining,
        limit: resourceLimit,
        used: resourceUsed,
        isUnlimited,
        plan: data.plan,
      };
    } catch (error) {
      console.error('Error checking limit:', error);
      // On error, allow the action (fail open) but log it
      return {
        canCreate: true,
        remaining: -1,
        limit: -1,
        used: 0,
        isUnlimited: true,
        plan: 'unknown',
      };
    } finally {
      setLoading(false);
    }
  }, [user]);

  const incrementUsage = useCallback(async (resource: ResourceType): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase.functions.invoke('check-limits', {
        body: { 
          userId: user.id, 
          action: 'increment', 
          resource 
        }
      });

      if (error) {
        console.error('Error incrementing usage:', error);
        return false;
      }

      if (data.error) {
        console.error('Limit reached:', data.error);
        return false;
      }

      return data.success === true;
    } catch (error) {
      console.error('Error incrementing usage:', error);
      return false;
    }
  }, [user]);

  const getPlanDisplayName = useCallback((planKey: string): string => {
    const names: Record<string, string> = {
      free: 'Gratuito',
      lite: 'Lite',
      pro: 'Pro',
      business: 'Business',
      essential: 'Lite',
      plus: 'Pro',
      scale: 'Business',
      internal: 'Interno (Ilimitado)',
    };
    return names[planKey] || planKey;
  }, []);

  return {
    checkLimit,
    incrementUsage,
    getPlanDisplayName,
    loading,
    limits,
    usage,
    plan,
  };
}
