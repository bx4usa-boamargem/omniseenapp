import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Territory } from './useTerritories';

export interface TerritoryMetrics {
  territoryId: string;
  territoryName: string;
  country: string;
  state: string | null;
  city: string | null;
  isActive: boolean;
  totalOpportunities: number;
  highScoreOpportunities: number; // >= 90
  convertedArticles: number;
  publishedArticles: number;
  conversionRate: number;
  avgScore: number;
  totalViews: number;
}

export interface UseTerritoryMetricsResult {
  metrics: TerritoryMetrics[];
  topPerformers: TerritoryMetrics[];
  highScoreAlerts: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTerritoryMetrics(blogId: string | undefined): UseTerritoryMetricsResult {
  const [metrics, setMetrics] = useState<TerritoryMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!blogId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all territories for this blog
      const { data: territories, error: terrError } = await supabase
        .from('territories')
        .select('*')
        .eq('blog_id', blogId)
        .order('created_at', { ascending: true });

      if (terrError) throw terrError;

      if (!territories || territories.length === 0) {
        setMetrics([]);
        setLoading(false);
        return;
      }

      // Fetch opportunities grouped by territory
      const { data: opportunities, error: oppError } = await supabase
        .from('article_opportunities')
        .select('id, territory_id, relevance_score, status')
        .eq('blog_id', blogId)
        .not('territory_id', 'is', null);

      if (oppError) throw oppError;

      // Fetch articles grouped by territory
      const { data: articles, error: artError } = await supabase
        .from('articles')
        .select('id, territory_id, status, view_count')
        .eq('blog_id', blogId)
        .not('territory_id', 'is', null);

      if (artError) throw artError;

      // Calculate metrics for each territory
      const metricsData: TerritoryMetrics[] = territories.map((territory: Territory) => {
        const territoryOpps = opportunities?.filter(o => o.territory_id === territory.id) || [];
        const territoryArticles = articles?.filter(a => a.territory_id === territory.id) || [];

        const totalOpportunities = territoryOpps.length;
        const highScoreOpportunities = territoryOpps.filter(o => (o.relevance_score ?? 0) >= 90).length;
        const convertedArticles = territoryOpps.filter(o => o.status === 'converted').length;
        const publishedArticles = territoryArticles.filter(a => a.status === 'published').length;
        const totalViews = territoryArticles.reduce((sum, a) => sum + (a.view_count || 0), 0);

        const scores = territoryOpps.map(o => o.relevance_score ?? 0).filter(s => s > 0);
        const avgScore = scores.length > 0 
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
          : 0;

        const conversionRate = totalOpportunities > 0 
          ? Math.round((convertedArticles / totalOpportunities) * 100) 
          : 0;

        // Format territory name
        const nameParts = [territory.city, territory.state, territory.country].filter(Boolean);
        const territoryName = nameParts.join(', ');

        return {
          territoryId: territory.id,
          territoryName,
          country: territory.country,
          state: territory.state,
          city: territory.city,
          isActive: territory.is_active,
          totalOpportunities,
          highScoreOpportunities,
          convertedArticles,
          publishedArticles,
          conversionRate,
          avgScore,
          totalViews,
        };
      });

      setMetrics(metricsData);
    } catch (err) {
      console.error('Error fetching territory metrics:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar métricas');
    } finally {
      setLoading(false);
    }
  }, [blogId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Top performers sorted by conversion rate
  const topPerformers = [...metrics]
    .filter(m => m.totalOpportunities > 0)
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, 5);

  // Total high score alerts across all territories
  const highScoreAlerts = metrics.reduce((sum, m) => sum + m.highScoreOpportunities, 0);

  return {
    metrics,
    topPerformers,
    highScoreAlerts,
    loading,
    error,
    refetch: fetchMetrics,
  };
}
