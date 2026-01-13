import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, MousePointerClick, TrendingUp, Target, ArrowUpRight, ArrowDownRight, Minus, DollarSign, BookOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ConversionFunnelChart } from '@/components/consultant/ConversionFunnelChart';
import { BusinessEconomicsAlert } from '@/components/roi/BusinessEconomicsAlert';
import { useBusinessEconomics } from '@/hooks/useBusinessEconomics';
import { EconomicsTooltip } from '@/components/roi/EconomicsTooltip';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';

interface SearchPerformanceTabProps {
  blogId?: string;
  period: '7d' | '30d' | '90d';
}

interface GSCMetrics {
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  impressionsDelta: number;
  clicksDelta: number;
}

interface ConversionMetrics {
  exposureCount: number;
  intentCount: number;
  exposureValue: number;
  intentValue: number;
  totalValue: number;
}

export function SearchPerformanceTab({ blogId, period }: SearchPerformanceTabProps) {
  const economics = useBusinessEconomics(blogId || null);
  const [gscMetrics, setGscMetrics] = useState<GSCMetrics>({
    impressions: 0,
    clicks: 0,
    ctr: 0,
    position: 0,
    impressionsDelta: 0,
    clicksDelta: 0
  });
  const [conversionMetrics, setConversionMetrics] = useState<ConversionMetrics>({
    exposureCount: 0,
    intentCount: 0,
    exposureValue: 0,
    intentValue: 0,
    totalValue: 0
  });
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!blogId) return;
    fetchData();
  }, [blogId, period, economics.valuePerExposure, economics.valuePerIntent]);

  const fetchData = async () => {
    if (!blogId) return;
    setLoading(true);

    try {
      const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Fetch GSC data
      const { data: gscData } = await supabase
        .from('gsc_pages_history')
        .select('*')
        .eq('blog_id', blogId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      // Fetch conversion metrics
      const { data: conversionData } = await supabase
        .from('article_conversion_metrics')
        .select('*')
        .eq('blog_id', blogId)
        .gte('date', startDate.toISOString().split('T')[0]);

      // Use values from economics hook
      const valuePerExposure = economics.valuePerExposure;
      const valuePerIntent = economics.valuePerIntent;

      // Aggregate GSC metrics
      if (gscData && gscData.length > 0) {
        const totalImpressions = gscData.reduce((sum, d) => sum + (d.impressions || 0), 0);
        const totalClicks = gscData.reduce((sum, d) => sum + (d.clicks || 0), 0);
        const avgCtr = totalClicks > 0 && totalImpressions > 0 
          ? (totalClicks / totalImpressions) * 100 
          : 0;
        const avgPosition = gscData.reduce((sum, d) => sum + (d.position || 0), 0) / gscData.length;

        // Calculate delta (compare first half to second half of period)
        const midpoint = Math.floor(gscData.length / 2);
        const firstHalf = gscData.slice(0, midpoint);
        const secondHalf = gscData.slice(midpoint);
        
        const firstHalfImpressions = firstHalf.reduce((sum, d) => sum + (d.impressions || 0), 0);
        const secondHalfImpressions = secondHalf.reduce((sum, d) => sum + (d.impressions || 0), 0);
        const firstHalfClicks = firstHalf.reduce((sum, d) => sum + (d.clicks || 0), 0);
        const secondHalfClicks = secondHalf.reduce((sum, d) => sum + (d.clicks || 0), 0);

        const impressionsDelta = firstHalfImpressions > 0 
          ? ((secondHalfImpressions - firstHalfImpressions) / firstHalfImpressions) * 100 
          : 0;
        const clicksDelta = firstHalfClicks > 0 
          ? ((secondHalfClicks - firstHalfClicks) / firstHalfClicks) * 100 
          : 0;

        setGscMetrics({
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: avgCtr,
          position: avgPosition,
          impressionsDelta,
          clicksDelta
        });

        // Prepare historical chart data
        const chartData = gscData.map(d => ({
          date: new Date(d.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          impressions: d.impressions || 0,
          clicks: d.clicks || 0
        }));
        setHistoricalData(chartData);
      }

      // Aggregate conversion metrics
      if (conversionData && conversionData.length > 0) {
        const totalExposure = conversionData.reduce((sum, d) => sum + (d.conversion_visibility_count || 0), 0);
        const totalIntent = conversionData.reduce((sum, d) => sum + (d.conversion_intent_count || 0), 0);

        setConversionMetrics({
          exposureCount: totalExposure,
          intentCount: totalIntent,
          exposureValue: totalExposure * valuePerExposure,
          intentValue: totalIntent * valuePerIntent,
          totalValue: (totalExposure * valuePerExposure) + (totalIntent * valuePerIntent)
        });
      }
    } catch (error) {
      console.error('Error fetching search performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const DeltaIndicator = ({ value }: { value: number }) => {
    if (Math.abs(value) < 0.5) {
      return <Minus className="h-4 w-4 text-gray-400" />;
    }
    if (value > 0) {
      return (
        <span className="flex items-center text-xs text-green-600 dark:text-green-400">
          <ArrowUpRight className="h-3 w-3" />
          +{value.toFixed(1)}%
        </span>
      );
    }
    return (
      <span className="flex items-center text-xs text-red-500 dark:text-red-400">
        <ArrowDownRight className="h-3 w-3" />
        {value.toFixed(1)}%
      </span>
    );
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Economics Alert */}
      {!economics.isLoading && !economics.isConfigured && (
        <BusinessEconomicsAlert />
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Eye className="h-5 w-5 text-blue-500" />
              <DeltaIndicator value={gscMetrics.impressionsDelta} />
            </div>
            <p className="text-2xl font-bold text-foreground">{formatNumber(gscMetrics.impressions)}</p>
            <p className="text-xs text-muted-foreground">Impressões</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <MousePointerClick className="h-5 w-5 text-green-500" />
              <DeltaIndicator value={gscMetrics.clicksDelta} />
            </div>
            <p className="text-2xl font-bold text-foreground">{formatNumber(gscMetrics.clicks)}</p>
            <p className="text-xs text-muted-foreground">Cliques</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{gscMetrics.ctr.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">CTR Médio</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <Target className="h-5 w-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-foreground">{gscMetrics.position.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Posição Média</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <BookOpen className="h-5 w-5 text-violet-500" />
              <EconomicsTooltip
                averageTicket={economics.averageTicket}
                closingRate={economics.closingRate}
                opportunityValue={economics.opportunityValue}
                valuePerExposure={economics.valuePerExposure}
                valuePerIntent={economics.valuePerIntent}
                isConfigured={economics.isConfigured}
              />
            </div>
            <p className="text-2xl font-bold text-foreground">{formatNumber(conversionMetrics.exposureCount)}</p>
            <p className="text-xs text-muted-foreground">Exposição Comercial</p>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
              {formatCurrency(conversionMetrics.exposureValue)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              <EconomicsTooltip
                averageTicket={economics.averageTicket}
                closingRate={economics.closingRate}
                opportunityValue={economics.opportunityValue}
                valuePerExposure={economics.valuePerExposure}
                valuePerIntent={economics.valuePerIntent}
                isConfigured={economics.isConfigured}
              />
            </div>
            <p className="text-2xl font-bold text-foreground">{formatNumber(conversionMetrics.intentCount)}</p>
            <p className="text-xs text-muted-foreground">Intenção Comercial</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
              {formatCurrency(conversionMetrics.intentValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Organic Growth Chart */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Crescimento Orgânico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={historicalData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="impressions" 
                    name="Impressões"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="clicks" 
                    name="Cliques"
                    stroke="#22c55e" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Conversion Funnel */}
        <ConversionFunnelChart
          impressions={gscMetrics.impressions}
          clicks={gscMetrics.clicks}
          exposureCount={conversionMetrics.exposureCount}
          intentCount={conversionMetrics.intentCount}
          totalValue={conversionMetrics.totalValue}
        />
      </div>

      {/* Value Message */}
      <Card className="bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/20">
        <CardContent className="p-6">
          <p className="text-center text-lg text-foreground">
            <span className="font-semibold">Aqui você não vê apenas visitas.</span>{' '}
            <span className="text-muted-foreground">Você vê dinheiro fluindo do Google para o seu funil.</span>
          </p>
          <p className="text-center text-3xl font-bold text-primary mt-3">
            {formatCurrency(conversionMetrics.totalValue)}
          </p>
          <p className="text-center text-sm text-muted-foreground mt-1">
            Valor estimado gerado no período
          </p>
          {economics.isConfigured && (
            <p className="text-center text-xs text-muted-foreground mt-2">
              Baseado no seu ticket médio de {formatCurrency(economics.averageTicket || 0)} e taxa de fechamento de {economics.closingRate}%
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
