import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, TrendingUp, Eye, MousePointer, Hash, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useBlog } from '@/hooks/useBlog';
import { useGSCConnection } from '@/hooks/useGSCConnection';
import { useGSCAnalytics } from '@/hooks/useGSCAnalytics';
import { PerformanceChart } from '@/components/client/PerformanceChart';
import { KeywordsTable } from '@/components/client/KeywordsTable';

export default function ClientPerformance() {
  const navigate = useNavigate();
  const { blog, loading: blogLoading } = useBlog();
  const { connection, isLoading: connectionLoading } = useGSCConnection(blog?.id);
  const { fetchPeriodComparison, fetchHistoricalData, fetchTopQueries, isLoading: analyticsLoading } = useGSCAnalytics(blog?.id);
  
  const [period, setPeriod] = useState<number>(28);
  const [comparison, setComparison] = useState<any>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [topQueries, setTopQueries] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (connection && blog?.id) {
      loadData();
    }
  }, [connection, blog?.id, period]);

  const loadData = async () => {
    if (!blog?.id) return;
    
    setDataLoading(true);
    try {
      const [comparisonData, historical, queries] = await Promise.all([
        fetchPeriodComparison(period),
        fetchHistoricalData(period),
        fetchTopQueries(20)
      ]);
      
      setComparison(comparisonData);
      setHistoricalData(historical || []);
      setTopQueries(queries || []);
    } catch (error) {
      console.error('Error loading GSC data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const isLoading = blogLoading || connectionLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Onboarding state - no GSC connection
  if (!connection) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Desempenho</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Acompanhe as métricas do seu blog no Google</p>
        </div>

        <div className="text-center py-16 client-card">
          <Search className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            Conecte o Google Search Console
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-md mx-auto">
            Veja cliques, impressões e palavras-chave posicionadas conectando sua conta do Google.
            Se você conectou recentemente, aguarde 48–72h para que o Google processe os primeiros acessos.
          </p>
          <Button 
            onClick={() => navigate('/client/integrations/gsc')}
            className="client-btn-primary"
          >
            Ir para Integrações
          </Button>
        </div>
      </div>
    );
  }

  // Connected but loading data
  if (dataLoading && !comparison) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Desempenho</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Carregando dados do Google Search Console...</p>
        </div>
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Connected with data
  const hasData = comparison && (comparison.current.clicks > 0 || comparison.current.impressions > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Desempenho</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Métricas reais do Google Search Console</p>
        </div>

        {/* Period selector */}
        <div className="flex gap-2">
          {[7, 28, 90].map((days) => (
            <Button
              key={days}
              variant={period === days ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod(days)}
              className={period === days 
                ? "bg-primary text-primary-foreground" 
                : "border-gray-300 dark:border-white/20 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10"
              }
            >
              {days}d
            </Button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-12 client-card">
          <TrendingUp className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Aguardando dados do Google
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Sua conta está conectada! O Google pode levar de 48 a 72 horas para processar 
            os primeiros acessos ao seu site. Volte em breve para ver suas métricas.
          </p>
        </div>
      ) : (
        <>
          {/* Cards de Visão Geral */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="client-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <MousePointer className="h-4 w-4" />
                  Cliques
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {comparison?.current.clicks.toLocaleString() || 0}
                </p>
                {comparison?.changes.clicks !== 0 && (
                  <p className={`text-sm ${comparison?.changes.clicks > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {comparison?.changes.clicks > 0 ? '+' : ''}{comparison?.changes.clicks.toFixed(1)}%
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="client-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Impressões
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {comparison?.current.impressions.toLocaleString() || 0}
                </p>
                {comparison?.changes.impressions !== 0 && (
                  <p className={`text-sm ${comparison?.changes.impressions > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {comparison?.changes.impressions > 0 ? '+' : ''}{comparison?.changes.impressions.toFixed(1)}%
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="client-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  CTR Médio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {(comparison?.current.ctr || 0).toFixed(2)}%
                </p>
                {comparison?.changes.ctr !== 0 && (
                  <p className={`text-sm ${comparison?.changes.ctr > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {comparison?.changes.ctr > 0 ? '+' : ''}{comparison?.changes.ctr.toFixed(1)}%
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="client-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  Palavras-chave
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {topQueries.length}
                </p>
                <p className="text-sm text-gray-500">posicionadas</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de Evolução */}
          <Card className="client-card">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Evolução de Cliques e Impressões</CardTitle>
            </CardHeader>
            <CardContent>
              <PerformanceChart data={historicalData} />
            </CardContent>
          </Card>

          {/* Tabela de Palavras-chave */}
          <Card className="client-card">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Palavras-chave Posicionadas</CardTitle>
            </CardHeader>
            <CardContent>
              <KeywordsTable data={topQueries} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
