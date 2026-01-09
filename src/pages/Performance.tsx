import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBlog } from "@/hooks/useBlog";
import { useGSCConnection } from "@/hooks/useGSCConnection";
import { useGSCAnalytics, GSCDataPoint, PeriodComparison } from "@/hooks/useGSCAnalytics";
import { Loader2, Eye, BarChart3, Sparkles } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { GSCConnectionCard } from "@/components/seo/GSCConnectionCard";
import { GSCOverviewCards } from "@/components/seo/GSCOverviewCards";
import { GSCTrendChart } from "@/components/seo/GSCTrendChart";
import { GSCRankingEvolution } from "@/components/seo/GSCRankingEvolution";
import { GSCTopQueries } from "@/components/seo/GSCTopQueries";
import { GSCTopPages } from "@/components/seo/GSCTopPages";
import { GSCPeriodComparison } from "@/components/seo/GSCPeriodComparison";
import { GSCAlertManager } from "@/components/seo/GSCAlertManager";
import { GSCDateRangeSelector } from "@/components/seo/GSCDateRangeSelector";
import { ArticleSEOList, ArticleSEOItem } from "@/components/seo/ArticleSEOList";
import { SEOAnalysisModal } from "@/components/seo/SEOAnalysisModal";
import { ContentSuggestionsCard } from "@/components/seo/ContentSuggestionsCard";
import { SEOScoreGauge } from "@/components/seo/SEOScoreGauge";

interface BlogStats {
  totalViews: number;
  totalShares: number;
  avgReadTime: number;
  topArticles: { id: string; title: string; view_count: number }[];
}

export default function Performance() {
  const { user } = useAuth();
  const { blog, loading: blogLoading } = useBlog();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(28);
  const [stats, setStats] = useState<BlogStats>({
    totalViews: 0,
    totalShares: 0,
    avgReadTime: 0,
    topArticles: [],
  });

  // GSC Hooks
  const { connection, isLoading: gscLoading, isConnecting, connect, disconnect, refetch, handleCallback } = useGSCConnection(blog?.id);
  const { isLoading: analyticsLoading, fetchAnalytics, fetchPeriodComparison, fetchHistoricalData, fetchTopQueries, fetchTopPages } = useGSCAnalytics(blog?.id);

  // GSC Data States
  const [gscDataLoading, setGscDataLoading] = useState(false);
  const [historicalData, setHistoricalData] = useState<GSCDataPoint[]>([]);
  const [topQueries, setTopQueries] = useState<GSCDataPoint[]>([]);
  const [topPages, setTopPages] = useState<GSCDataPoint[]>([]);
  const [periodComparison, setPeriodComparison] = useState<PeriodComparison | null>(null);

  // SEO Analysis States
  const [selectedArticleForSEO, setSelectedArticleForSEO] = useState<ArticleSEOItem | null>(null);
  const [showSEOModal, setShowSEOModal] = useState(false);
  const [seoListKey, setSeoListKey] = useState(0);
  const [avgSEOScore, setAvgSEOScore] = useState(0);
  const [totalPublishedArticles, setTotalPublishedArticles] = useState(0);
  const [isRecalculatingScore, setIsRecalculatingScore] = useState(false);

  // Handle GSC OAuth callback
  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    if (code && state) {
      handleCallback(code, state).then(() => {
        toast.success("Google Search Console conectado com sucesso!");
        window.history.replaceState({}, document.title, window.location.pathname);
      });
    }
  }, [searchParams, handleCallback]);

  // Fetch blog stats
  useEffect(() => {
    async function fetchData() {
      if (!user || !blog) return;

      try {
        const { data: articlesData } = await supabase
          .from("articles")
          .select("id, title, view_count, share_count, reading_time")
          .eq("blog_id", blog.id)
          .eq("status", "published")
          .order("view_count", { ascending: false })
          .limit(10);

        if (articlesData) {
          const totalViews = articlesData.reduce((sum, a) => sum + (a.view_count || 0), 0);
          const totalShares = articlesData.reduce((sum, a) => sum + (a.share_count || 0), 0);
          const avgReadTime = articlesData.length > 0
            ? Math.round(articlesData.reduce((sum, a) => sum + (a.reading_time || 0), 0) / articlesData.length)
            : 0;

          setStats({
            totalViews,
            totalShares,
            avgReadTime,
            topArticles: articlesData.slice(0, 5).map((a) => ({
              id: a.id,
              title: a.title,
              view_count: a.view_count || 0,
            })),
          });
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    }

    if (blog) {
      fetchData();
    } else if (!blogLoading) {
      setLoading(false);
    }
  }, [user, blog, blogLoading]);

  // Fetch GSC data when connected
  const loadGSCData = useCallback(async () => {
    if (!connection || !blog) return;

    setGscDataLoading(true);
    try {
      // Fetch all data in parallel
      const [analyticsResult, comparisonResult, historicalResult, queriesResult, pagesResult] = await Promise.all([
        fetchAnalytics("date", undefined, undefined, dateRange),
        fetchPeriodComparison(dateRange),
        fetchHistoricalData(dateRange),
        fetchTopQueries(10),
        fetchTopPages(10),
      ]);

      if (historicalResult) setHistoricalData(historicalResult);
      if (comparisonResult) setPeriodComparison(comparisonResult);
      if (queriesResult) setTopQueries(queriesResult);
      if (pagesResult) setTopPages(pagesResult);
    } catch (error) {
      console.error("Error loading GSC data:", error);
    } finally {
      setGscDataLoading(false);
    }
  }, [connection, blog, dateRange, fetchAnalytics, fetchPeriodComparison, fetchHistoricalData, fetchTopQueries, fetchTopPages]);

  useEffect(() => {
    if (connection) {
      loadGSCData();
    }
  }, [connection, loadGSCData]);

  const handleRefresh = async () => {
    await refetch();
    if (connection) {
      await loadGSCData();
    }
    toast.success("Dados atualizados");
  };

  if (loading || blogLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">Desempenho</h1>
          <p className="text-muted-foreground">
            Acompanhe o desempenho do seu blog e dos seus artigos.
          </p>
        </div>

        {/* Quick Stats with SEO Gauge */}
        <div className="grid gap-4 md:grid-cols-5 mb-8">
          {/* SEO Score Gauge */}
          <Card className={`border-primary/20 bg-gradient-to-br from-primary/5 to-transparent transition-opacity duration-300 ${isRecalculatingScore ? 'opacity-50' : ''}`}>
            <CardHeader className="pb-2 text-center">
              <CardTitle className="text-sm font-medium flex items-center justify-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Blog SEO Score
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center pb-4 relative">
              {isRecalculatingScore && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-lg z-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              <SEOScoreGauge 
                score={avgSEOScore} 
                size="md" 
                showLabel={true}
                animated={true}
                className={isRecalculatingScore ? "animate-pulse" : ""}
              />
              <p className="text-xs text-muted-foreground mt-2">
                {totalPublishedArticles} artigo{totalPublishedArticles !== 1 ? 's' : ''} analisado{totalPublishedArticles !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Visualizações</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalViews.toLocaleString("pt-BR")}</div>
              <p className="text-xs text-muted-foreground">Total de visualizações</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Compartilhamentos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalShares.toLocaleString("pt-BR")}</div>
              <p className="text-xs text-muted-foreground">Total de shares</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avgReadTime} min</div>
              <p className="text-xs text-muted-foreground">Leitura média</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Top Artigos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.topArticles.length}</div>
              <p className="text-xs text-muted-foreground">Artigos publicados</p>
            </CardContent>
          </Card>
        </div>

        {/* Google Search Console Section */}
        <div className="space-y-6 mb-8">
          <GSCConnectionCard
            connection={connection}
            isLoading={gscLoading}
            isConnecting={isConnecting}
            onConnect={connect}
            onDisconnect={disconnect}
            onRefresh={handleRefresh}
          />

          {connection && (
            <>
              {/* Date Range Selector */}
              <div className="flex justify-end">
                <GSCDateRangeSelector value={dateRange} onChange={setDateRange} />
              </div>

              {/* GSC Overview Cards */}
              <GSCOverviewCards
                aggregated={periodComparison?.current || null}
                comparison={periodComparison}
                isLoading={gscDataLoading}
              />

              {/* Period Comparison */}
              <GSCPeriodComparison
                comparison={periodComparison}
                isLoading={gscDataLoading}
                periodDays={dateRange}
              />

              {/* Trend Charts */}
              <div className="grid gap-6 lg:grid-cols-2">
                <GSCTrendChart data={historicalData} isLoading={gscDataLoading} />
                <GSCRankingEvolution data={historicalData} isLoading={gscDataLoading} />
              </div>

              {/* Top Queries and Pages */}
              <div className="grid gap-6 lg:grid-cols-2">
                <GSCTopQueries queries={topQueries} isLoading={gscDataLoading} />
                <GSCTopPages pages={topPages} isLoading={gscDataLoading} />
              </div>

              {/* Alert Manager */}
              {blog && <GSCAlertManager blogId={blog.id} />}

              {/* Content Suggestions based on GSC */}
              <ContentSuggestionsCard blogId={blog?.id || ""} topQueries={topQueries} />
            </>
          )}
        </div>

        {/* AI SEO Analysis Section */}
        <div className="space-y-6 mb-8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Análise SEO com IA</h2>
              <p className="text-sm text-muted-foreground">
                Analise e corrija problemas de SEO nos seus artigos automaticamente
              </p>
            </div>
          </div>

          {blog && (
            <ArticleSEOList
              key={seoListKey}
              blogId={blog.id}
              userId={user?.id}
              onSelectArticle={(article) => {
                setSelectedArticleForSEO(article);
                setShowSEOModal(true);
              }}
              onScoreCalculated={(avgScore, total) => {
                setAvgSEOScore(avgScore);
                setTotalPublishedArticles(total);
                setIsRecalculatingScore(false);
              }}
              onOptimizationStart={() => setIsRecalculatingScore(true)}
            />
          )}
        </div>

        {/* SEO Analysis Modal */}
        <SEOAnalysisModal
          article={selectedArticleForSEO}
          open={showSEOModal}
          onOpenChange={setShowSEOModal}
          blogId={blog?.id || ""}
          userId={user?.id || ""}
          onArticleUpdated={() => setSeoListKey((prev) => prev + 1)}
        />

        {/* Top Articles */}
        <Card>
          <CardHeader>
            <CardTitle>Artigos Mais Visualizados</CardTitle>
            <CardDescription>
              Os artigos com melhor desempenho no seu blog.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.topArticles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum artigo publicado ainda.</p>
                <Button variant="link" onClick={() => navigate("/app/articles/new")}>
                  Criar primeiro artigo
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.topArticles.map((article, index) => (
                  <div
                    key={article.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/app/articles/${article.id}/edit`)}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-bold text-muted-foreground w-6">
                        {index + 1}
                      </span>
                      <div>
                        <h4 className="font-medium">{article.title}</h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Eye className="h-4 w-4" />
                      <span className="font-medium">{article.view_count.toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Link to detailed analytics */}
        <div className="mt-6 text-center">
          <Button variant="outline" onClick={() => navigate("/app/analytics")}>
            <BarChart3 className="h-4 w-4 mr-2" />
            Ver Analytics Detalhado
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}