import { useState, useEffect, useMemo } from 'react';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, TrendingUp, RefreshCw, BarChart3, Search, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MetricsTab } from '@/components/consultant/tabs/MetricsTab';
import { SearchPerformanceTab } from '@/components/consultant/tabs/SearchPerformanceTab';
import { ROIRealTab } from '@/components/consultant/tabs/ROIRealTab';

type Period = '7d' | '30d' | '90d';

interface Opportunity {
  id: string;
  suggested_title: string;
  relevance_score: number;
  suggested_keywords?: string[];
  status: string;
  created_at: string;
  converted_at?: string;
}

interface Article {
  id: string;
  status: string;
  view_count: number;
  share_count: number;
  created_at: string;
}

export default function ClientConsultantMetrics() {
  const { blog } = useBlog();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<Period>('30d');
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [activeTab, setActiveTab] = useState('metrics');

  const getPeriodDays = (p: Period): number => {
    switch (p) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
    }
  };

  const fetchData = async () => {
    if (!blog?.id) return;

    try {
      const daysAgo = getPeriodDays(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);
      const startDateStr = startDate.toISOString();

      // Fetch opportunities
      const { data: opportunitiesData } = await supabase
        .from('article_opportunities')
        .select('id, suggested_title, relevance_score, suggested_keywords, status, created_at, converted_at')
        .eq('blog_id', blog.id)
        .gte('created_at', startDateStr);

      // Fetch articles (for engagement metrics)
      const { data: articlesData } = await supabase
        .from('articles')
        .select('id, status, view_count, share_count, created_at')
        .eq('blog_id', blog.id)
        .gte('created_at', startDateStr);

      setOpportunities((opportunitiesData as Opportunity[]) || []);
      setArticles((articlesData as Article[]) || []);
    } catch (error) {
      console.error('Error fetching metrics:', error);
      toast.error('Erro ao carregar métricas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [blog?.id, period]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    toast.success('Métricas atualizadas');
  };

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalOpportunities = opportunities.length;
    const highScoreOpportunities = opportunities.filter(o => (o.relevance_score || 0) >= 90).length;
    const mediumScoreOpportunities = opportunities.filter(o => {
      const score = o.relevance_score || 0;
      return score >= 70 && score < 90;
    }).length;
    const lowScoreOpportunities = opportunities.filter(o => (o.relevance_score || 0) < 70).length;
    
    const convertedToArticles = opportunities.filter(o => o.status === 'converted').length;
    const publishedArticles = articles.filter(a => a.status === 'published').length;
    
    const radarUtilizationRate = highScoreOpportunities > 0 
      ? (convertedToArticles / highScoreOpportunities) * 100 
      : 0;
    
    const totalViews = articles.reduce((sum, a) => sum + (a.view_count || 0), 0);
    const totalShares = articles.reduce((sum, a) => sum + (a.share_count || 0), 0);
    
    // ROI calculation
    const valuePerView = 0.50;
    const valuePerShare = 2.00;
    const valuePerArticle = 200.00;
    const valuePerHighScore = 50.00;
    
    const estimatedROI = 
      (totalViews * valuePerView) +
      (totalShares * valuePerShare) +
      (publishedArticles * valuePerArticle) +
      (highScoreOpportunities * valuePerHighScore);

    return {
      totalOpportunities,
      highScoreOpportunities,
      mediumScoreOpportunities,
      lowScoreOpportunities,
      convertedToArticles,
      publishedArticles,
      radarUtilizationRate,
      totalViews,
      totalShares,
      estimatedROI
    };
  }, [opportunities, articles]);

  // Generate evolution data for chart
  const evolutionData = useMemo(() => {
    const daysAgo = getPeriodDays(period);
    const data: { date: string; highScore: number; converted: number }[] = [];
    
    for (let i = daysAgo - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayOpportunities = opportunities.filter(o => 
        o.created_at.split('T')[0] === dateStr
      );
      
      data.push({
        date: dateStr,
        highScore: dayOpportunities.filter(o => (o.relevance_score || 0) >= 90).length,
        converted: dayOpportunities.filter(o => o.status === 'converted').length
      });
    }
    
    // Only return data with some values
    return data.filter((_, index, arr) => {
      // Show every Nth point for readability
      const step = Math.max(1, Math.floor(arr.length / 15));
      return index % step === 0 || index === arr.length - 1;
    });
  }, [opportunities, period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-gray-800 dark:text-white">
            <TrendingUp className="h-7 w-7 text-primary" />
            Resultados & ROI
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Acompanhe oportunidades, conversões e o valor real gerado
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <div className="flex rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
            {(['7d', '30d', '90d'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium transition-colors",
                  period === p
                    ? "bg-primary text-white"
                    : "bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/10"
                )}
              >
                {p}
              </button>
            ))}
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Métricas</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Performance de Busca</span>
          </TabsTrigger>
          <TabsTrigger value="roi" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">ROI Real</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-6">
          <MetricsTab 
            metrics={metrics}
            evolutionData={evolutionData}
            opportunities={opportunities}
            blogId={blog?.id}
          />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <SearchPerformanceTab blogId={blog?.id} period={period} />
        </TabsContent>

        <TabsContent value="roi" className="space-y-6">
          <ROIRealTab blogId={blog?.id} period={period} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
