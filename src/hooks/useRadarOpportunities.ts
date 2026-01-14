import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RadarOpportunity {
  id: string;
  suggested_title: string;
  relevance_score: number | null;
  suggested_keywords: string[] | null;
  status: string | null;
  why_now: string | null;
  created_at: string;
}

interface UseRadarOpportunitiesResult {
  opportunities: RadarOpportunity[];
  totalPending: number;
  lastUpdatedAt: Date | null;
  loading: boolean;
  refetch: () => void;
}

export function useRadarOpportunities(blogId: string | undefined, limit = 5): UseRadarOpportunitiesResult {
  const [opportunities, setOpportunities] = useState<RadarOpportunity[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!blogId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Fetch top opportunities by relevance score (not converted/archived)
      const { data: opps, error: oppsError } = await supabase
        .from('article_opportunities')
        .select('id, suggested_title, relevance_score, suggested_keywords, status, why_now, created_at')
        .eq('blog_id', blogId)
        .not('status', 'eq', 'converted')
        .not('status', 'eq', 'archived')
        .order('relevance_score', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (oppsError) {
        console.error('Error fetching opportunities:', oppsError);
      } else {
        setOpportunities(opps || []);
      }

      // Count total pending opportunities
      const { count, error: countError } = await supabase
        .from('article_opportunities')
        .select('id', { count: 'exact', head: true })
        .eq('blog_id', blogId)
        .not('status', 'eq', 'converted')
        .not('status', 'eq', 'archived');

      if (countError) {
        console.error('Error counting opportunities:', countError);
      } else {
        setTotalPending(count || 0);
      }

      // Fetch last market intel update
      const { data: lastIntel, error: intelError } = await supabase
        .from('market_intel_weekly')
        .select('generated_at')
        .eq('blog_id', blogId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (intelError) {
        console.error('Error fetching last intel:', intelError);
      } else if (lastIntel?.generated_at) {
        setLastUpdatedAt(new Date(lastIntel.generated_at));
      }
    } catch (error) {
      console.error('Error in useRadarOpportunities:', error);
    } finally {
      setLoading(false);
    }
  }, [blogId, limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    opportunities,
    totalPending,
    lastUpdatedAt,
    loading,
    refetch: fetchData
  };
}
