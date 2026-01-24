import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ValueProofMetrics {
  // Core metrics
  visits: number;
  visitsDelta: number | null; // % change vs previous period
  ctaClicks: number;
  clicksDelta: number | null;
  realLeads: number;
  leadsDelta: number | null;
  
  // Status indicators
  hasData: boolean;
}

interface UseValueProofMetricsReturn {
  metrics: ValueProofMetrics;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DEFAULT_METRICS: ValueProofMetrics = {
  visits: 0,
  visitsDelta: null,
  ctaClicks: 0,
  clicksDelta: null,
  realLeads: 0,
  leadsDelta: null,
  hasData: false,
};

export function useValueProofMetrics(blogId: string | undefined): UseValueProofMetricsReturn {
  const [metrics, setMetrics] = useState<ValueProofMetrics>(DEFAULT_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!blogId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      
      // Calculate date ranges (last 7 days vs previous 7 days)
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      
      const currentStart = sevenDaysAgo.toISOString();
      const previousStart = fourteenDaysAgo.toISOString();
      const previousEnd = sevenDaysAgo.toISOString();

      // Fetch all data in parallel
      const [
        visitsResult,
        previousVisitsResult,
        ctaClicksResult,
        previousCtaClicksResult,
        realLeadsResult,
        previousLeadsResult,
      ] = await Promise.all([
        // Current period visits (from articles view_count)
        supabase
          .from('articles')
          .select('view_count')
          .eq('blog_id', blogId)
          .eq('status', 'published'),
        
        // Previous period visits (from article_analytics for comparison)
        supabase
          .from('article_analytics')
          .select('id', { count: 'exact', head: true })
          .eq('blog_id', blogId)
          .gte('created_at', previousStart)
          .lt('created_at', previousEnd),
        
        // Current CTA clicks
        supabase
          .from('funnel_events')
          .select('id', { count: 'exact', head: true })
          .eq('blog_id', blogId)
          .eq('event_type', 'cta_click')
          .gte('created_at', currentStart),
        
        // Previous CTA clicks
        supabase
          .from('funnel_events')
          .select('id', { count: 'exact', head: true })
          .eq('blog_id', blogId)
          .eq('event_type', 'cta_click')
          .gte('created_at', previousStart)
          .lt('created_at', previousEnd),
        
        // Current real leads
        supabase
          .from('real_leads')
          .select('id', { count: 'exact', head: true })
          .eq('blog_id', blogId)
          .gte('created_at', currentStart),
        
        // Previous real leads
        supabase
          .from('real_leads')
          .select('id', { count: 'exact', head: true })
          .eq('blog_id', blogId)
          .gte('created_at', previousStart)
          .lt('created_at', previousEnd),
      ]);

      // Calculate visits
      const visits = visitsResult.data?.reduce((sum, a) => sum + (a.view_count || 0), 0) || 0;
      const previousVisits = previousVisitsResult.count || 0;
      const visitsDelta = previousVisits > 0 
        ? Math.round(((visits - previousVisits) / previousVisits) * 100) 
        : visits > 0 ? 100 : null;

      // CTA clicks
      const ctaClicks = ctaClicksResult.count || 0;
      const previousCtaClicks = previousCtaClicksResult.count || 0;
      const clicksDelta = previousCtaClicks > 0
        ? Math.round(((ctaClicks - previousCtaClicks) / previousCtaClicks) * 100)
        : ctaClicks > 0 ? 100 : null;

      // Real leads
      const realLeads = realLeadsResult.count || 0;
      const previousLeads = previousLeadsResult.count || 0;
      const leadsDelta = previousLeads > 0
        ? Math.round(((realLeads - previousLeads) / previousLeads) * 100)
        : realLeads > 0 ? 100 : null;

      const hasData = visits > 0 || ctaClicks > 0 || realLeads > 0;

      setMetrics({
        visits,
        visitsDelta,
        ctaClicks,
        clicksDelta,
        realLeads,
        leadsDelta,
        hasData,
      });
    } catch (err) {
      console.error('Error fetching value proof metrics:', err);
      setError('Erro ao carregar métricas');
    } finally {
      setLoading(false);
    }
  }, [blogId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    refresh: fetchMetrics,
  };
}