import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Target, Eye, TrendingUp, MousePointerClick, BarChart3, FileText, Sparkles } from "lucide-react";
import { FunnelStageCard } from "./FunnelStageCard";
import { FunnelModal } from "./FunnelModal";
import { FunnelPerformanceComparison } from "./FunnelPerformanceComparison";
import { FunnelConversionDashboard } from "./FunnelConversionDashboard";
import { FunnelTimeComparison } from "./FunnelTimeComparison";
import { FunnelReportDialog } from "./FunnelReportDialog";
import { FunnelPersonaComparison } from "./FunnelPersonaComparison";
import { subDays } from "date-fns";

interface SalesFunnelTabProps {
  blogId: string;
  isClientContext?: boolean;
}

interface ArticleWithMetrics {
  id: string;
  title: string;
  status: string;
  view_count: number;
  funnel_stage: string | null;
  published_at: string | null;
  metrics: {
    readRate: number;
    scroll50: number;
    ctaRate: number;
  };
}

export function SalesFunnelTab({ blogId, isClientContext = false }: SalesFunnelTabProps) {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("7");
  const [articles, setArticles] = useState<ArticleWithMetrics[]>([]);
  const [funnelModalOpen, setFunnelModalOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [blogName, setBlogName] = useState("");

  useEffect(() => {
    fetchFunnelArticles();
    fetchBlogName();
  }, [blogId, period]);

  async function fetchBlogName() {
    const { data } = await supabase
      .from('blogs')
      .select('name')
      .eq('id', blogId)
      .single();
    if (data) setBlogName(data.name);
  }

  async function fetchFunnelArticles() {
    setLoading(true);

    // Fetch articles generated from sales funnel
    const { data: articlesData, error: articlesError } = await supabase
      .from('articles')
      .select('id, title, status, view_count, funnel_stage, published_at')
      .eq('blog_id', blogId)
      .eq('generation_source', 'sales_funnel')
      .order('created_at', { ascending: false });

    if (articlesError || !articlesData || articlesData.length === 0) {
      setArticles([]);
      setLoading(false);
      return;
    }

    const articleIds = articlesData.map(a => a.id);
    const startDate = subDays(new Date(), parseInt(period)).toISOString();

    // Fetch funnel events for metrics
    const { data: events } = await supabase
      .from('funnel_events')
      .select('event_type, article_id')
      .eq('blog_id', blogId)
      .in('article_id', articleIds)
      .gte('created_at', startDate);

    // Calculate metrics per article
    const articlesWithMetrics: ArticleWithMetrics[] = articlesData.map(article => {
      const articleEvents = events?.filter(e => e.article_id === article.id) || [];
      const pageEnter = articleEvents.filter(e => e.event_type === 'page_enter').length;
      const scroll50 = articleEvents.filter(e => e.event_type === 'scroll_50').length;
      const scroll100 = articleEvents.filter(e => e.event_type === 'scroll_100').length;
      const ctaClick = articleEvents.filter(e => e.event_type === 'cta_click').length;

      return {
        ...article,
        metrics: {
          readRate: pageEnter > 0 ? Math.round((scroll100 / pageEnter) * 100) : 0,
          scroll50: pageEnter > 0 ? Math.round((scroll50 / pageEnter) * 100) : 0,
          ctaRate: pageEnter > 0 ? Math.round((ctaClick / pageEnter) * 100) : 0,
        },
      };
    });

    setArticles(articlesWithMetrics);
    setLoading(false);
  }

  const topArticles = articles.filter(a => a.funnel_stage === 'top');
  const middleArticles = articles.filter(a => a.funnel_stage === 'middle');
  const bottomArticles = articles.filter(a => a.funnel_stage === 'bottom');

  // Overall metrics
  const totalViews = articles.reduce((sum, a) => sum + a.view_count, 0);
  const avgReadRate = articles.length > 0 
    ? Math.round(articles.reduce((sum, a) => sum + a.metrics.readRate, 0) / articles.length) 
    : 0;
  const avgScroll50 = articles.length > 0 
    ? Math.round(articles.reduce((sum, a) => sum + a.metrics.scroll50, 0) / articles.length) 
    : 0;
  const avgCta = articles.length > 0 
    ? Math.round(articles.reduce((sum, a) => sum + a.metrics.ctaRate, 0) / articles.length) 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <Target className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Comece seu Funil de Vendas</h3>
        <p className="text-muted-foreground mb-2 max-w-md mx-auto">
          Crie artigos organizados por etapa do funil para guiar seus leitores da consciência até a decisão de compra.
        </p>
        <p className="text-sm text-primary mb-6">
          Não é necessário configurar persona ou estratégia antes.
        </p>
        <Button onClick={() => setFunnelModalOpen(true)} className="gradient-primary">
          <Sparkles className="h-4 w-4 mr-2" />
          Criar artigos pelo Funil
        </Button>
        <p className="text-xs text-muted-foreground mt-4">
          O sistema usa padrões inteligentes se você não tiver configurações.
        </p>
        <FunnelModal 
          open={funnelModalOpen} 
          onOpenChange={setFunnelModalOpen}
          blogId={blogId}
          onContinue={() => fetchFunnelArticles()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setReportDialogOpen(true)} variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Gerar Relatório
          </Button>
          <Button onClick={() => setFunnelModalOpen(true)} variant="outline">
            <Target className="h-4 w-4 mr-2" />
            Criar mais artigos
          </Button>
        </div>
      </div>

      {/* Overall Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
              <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{articles.length}</p>
              <p className="text-xs text-muted-foreground">Artigos no Funil</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
              <Eye className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Views Totais</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgReadRate}%</p>
              <p className="text-xs text-muted-foreground">Leitura Completa</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
              <MousePointerClick className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{avgCta}%</p>
              <p className="text-xs text-muted-foreground">Taxa de CTA</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Conversion Dashboard */}
      <FunnelConversionDashboard
        topArticles={topArticles}
        middleArticles={middleArticles}
        bottomArticles={bottomArticles}
        period={period}
        blogId={blogId}
      />

      {/* Time Comparison Chart */}
      <FunnelTimeComparison blogId={blogId} />

      {/* Persona Comparison */}
      <FunnelPersonaComparison blogId={blogId} articles={articles} />

      {/* Performance Comparison */}
      <FunnelPerformanceComparison
        topArticles={topArticles}
        middleArticles={middleArticles}
        bottomArticles={bottomArticles}
      />

      {/* Funnel Stages */}
      <div className="space-y-4">
        <FunnelStageCard stage="top" articles={topArticles} />
        <FunnelStageCard stage="middle" articles={middleArticles} />
        <FunnelStageCard stage="bottom" articles={bottomArticles} />
      </div>

      <FunnelModal 
        open={funnelModalOpen} 
        onOpenChange={setFunnelModalOpen}
        blogId={blogId}
        onContinue={() => {
          setFunnelModalOpen(false);
          fetchFunnelArticles();
        }}
      />

      <FunnelReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        blogId={blogId}
        blogName={blogName}
        articles={articles}
      />
    </div>
  );
}
