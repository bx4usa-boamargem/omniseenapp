import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Target, DollarSign, TrendingUp, Settings, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ConversionValueCards } from '@/components/consultant/ConversionValueCards';
import { BusinessEconomicsAlert } from '@/components/roi/BusinessEconomicsAlert';
import { useBusinessEconomics } from '@/hooks/useBusinessEconomics';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart
} from 'recharts';

interface ROIRealTabProps {
  blogId?: string;
  period: '7d' | '30d' | '90d';
}

type ViewMode = 'projection' | 'real' | 'difference';

interface ROIData {
  projectedValue: number;
  realValue: number;
  delta: number;
  deltaPercent: number;
  projectedOpportunities: number;
  realArticles: number;
  realExposure: number;
  realIntent: number;
}

export function ROIRealTab({ blogId, period }: ROIRealTabProps) {
  const navigate = useNavigate();
  const economics = useBusinessEconomics(blogId || null);
  const [viewMode, setViewMode] = useState<ViewMode>('real');
  const [roiData, setRoiData] = useState<ROIData>({
    projectedValue: 0,
    realValue: 0,
    delta: 0,
    deltaPercent: 0,
    projectedOpportunities: 0,
    realArticles: 0,
    realExposure: 0,
    realIntent: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!blogId || economics.isLoading) return;
    fetchROIData();
  }, [blogId, period, economics.valuePerExposure, economics.valuePerIntent, economics.isLoading]);

  const fetchROIData = async () => {
    if (!blogId) return;
    setLoading(true);

    try {
      const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      // Use values from economics hook
      const valuePerExposure = economics.valuePerExposure;
      const valuePerIntent = economics.valuePerIntent;

      // Fetch opportunities for projection
      const { data: opportunities } = await supabase
        .from('article_opportunities')
        .select('id, relevance_score, created_at')
        .eq('blog_id', blogId)
        .gte('created_at', startDate.toISOString());

      // Fetch real conversion metrics
      const { data: conversionMetrics } = await supabase
        .from('article_conversion_metrics')
        .select('*')
        .eq('blog_id', blogId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('date', { ascending: true });

      // Fetch articles created in period
      const { data: articles } = await supabase
        .from('articles')
        .select('id, status')
        .eq('blog_id', blogId)
        .gte('created_at', startDate.toISOString());

      // Calculate projections based on opportunities
      const highScoreOpps = (opportunities || []).filter(o => (o.relevance_score || 0) >= 80);
      const projectedViews = highScoreOpps.length * 150; // Estimate 150 views per high-score opportunity
      const projectedExposure = Math.floor(projectedViews * 0.4); // 40% read deeply
      const projectedIntent = Math.floor(projectedExposure * 0.15); // 15% click CTA
      const projectedValue = (projectedExposure * valuePerExposure) + (projectedIntent * valuePerIntent);

      // Calculate real values
      const realExposure = (conversionMetrics || []).reduce((sum, m) => sum + (m.conversion_visibility_count || 0), 0);
      const realIntent = (conversionMetrics || []).reduce((sum, m) => sum + (m.conversion_intent_count || 0), 0);
      const realValue = (realExposure * valuePerExposure) + (realIntent * valuePerIntent);

      const delta = realValue - projectedValue;
      const deltaPercent = projectedValue > 0 ? (delta / projectedValue) * 100 : 0;

      setRoiData({
        projectedValue,
        realValue,
        delta,
        deltaPercent,
        projectedOpportunities: highScoreOpps.length,
        realArticles: (articles || []).filter(a => a.status === 'published').length,
        realExposure,
        realIntent
      });

      // Generate chart data
      const chartPoints: any[] = [];
      let cumulativeProjected = 0;
      let cumulativeReal = 0;

      for (let i = 0; i < daysAgo; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        // Daily projection (linear distribution)
        const dailyProjected = projectedValue / daysAgo;
        cumulativeProjected += dailyProjected;

        // Real daily value
        const dayMetrics = (conversionMetrics || []).filter(m => m.date === dateStr);
        const dayExposure = dayMetrics.reduce((sum, m) => sum + (m.conversion_visibility_count || 0), 0);
        const dayIntent = dayMetrics.reduce((sum, m) => sum + (m.conversion_intent_count || 0), 0);
        const dayValue = (dayExposure * valuePerExposure) + (dayIntent * valuePerIntent);
        cumulativeReal += dayValue;

        chartPoints.push({
          date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
          projected: Math.round(cumulativeProjected),
          real: Math.round(cumulativeReal),
          difference: Math.round(cumulativeReal - cumulativeProjected)
        });
      }

      // Filter for readability
      const step = Math.max(1, Math.floor(chartPoints.length / 15));
      setChartData(chartPoints.filter((_, i) => i % step === 0 || i === chartPoints.length - 1));

    } catch (error) {
      console.error('Error fetching ROI data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const DeltaCard = () => {
    const isPositive = roiData.delta >= 0;
    const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
    
    return (
      <Card className={cn(
        "border-2",
        isPositive 
          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" 
          : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
      )}>
        <CardContent className="p-6 text-center">
          <div className={cn(
            "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-3",
            isPositive 
              ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300" 
              : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
          )}>
            <Icon className="h-4 w-4" />
            Delta: {roiData.deltaPercent > 0 ? '+' : ''}{roiData.deltaPercent.toFixed(1)}%
          </div>
          <p className={cn(
            "text-3xl font-bold",
            isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}>
            {roiData.delta > 0 ? '+' : ''}{formatCurrency(roiData.delta)}
          </p>
          <p className={cn(
            "text-sm mt-2",
            isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}>
            {isPositive 
              ? "Você está superando as projeções! 🎉" 
              : "Oportunidade de otimização identificada"
            }
          </p>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Economics Alert */}
      {!economics.isLoading && !economics.isConfigured && (
        <BusinessEconomicsAlert />
      )}

      {/* View Mode Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {(['projection', 'real', 'difference'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                viewMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-accent"
              )}
            >
              {mode === 'projection' ? 'Projeção' : mode === 'real' ? 'Real' : 'Diferença'}
            </button>
          ))}
        </div>
      </div>

      {/* Conversion Value Cards */}
      <ConversionValueCards
        exposureCount={roiData.realExposure}
        intentCount={roiData.realIntent}
        valuePerExposure={economics.valuePerExposure}
        valuePerIntent={economics.valuePerIntent}
        averageTicket={economics.averageTicket}
        closingRate={economics.closingRate}
        opportunityValue={economics.opportunityValue}
        isConfigured={economics.isConfigured}
      />

      {/* Projection vs Real Chart */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Projeção vs Execução Real
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis 
                  tick={{ fontSize: 12 }} 
                  className="text-muted-foreground"
                  tickFormatter={(value) => `R$${(value/1000).toFixed(0)}k`}
                />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Legend />
                {(viewMode === 'projection' || viewMode === 'difference') && (
                  <Area 
                    type="monotone" 
                    dataKey="projected" 
                    name="Projetado"
                    stroke="hsl(var(--primary))" 
                    fill="hsl(var(--primary) / 0.2)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                  />
                )}
                {(viewMode === 'real' || viewMode === 'difference') && (
                  <Area 
                    type="monotone" 
                    dataKey="real" 
                    name="Real"
                    stroke="#22c55e" 
                    fill="#22c55e20"
                    strokeWidth={2}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Delta Card */}
      <DeltaCard />

      {/* Value Configuration */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            Configuração de Valor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex gap-8">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Exposição Comercial</p>
                <p className="text-xl font-bold text-violet-600 dark:text-violet-400">{formatCurrency(economics.valuePerExposure)}</p>
                <p className="text-xs text-muted-foreground">10% do valor da oportunidade</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Intenção Comercial</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(economics.valuePerIntent)}</p>
                <p className="text-xs text-muted-foreground">150% do valor da oportunidade</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => navigate('/client/company')}
            >
              <Settings className="h-4 w-4 mr-2" />
              {economics.isConfigured ? 'Editar Economia' : 'Configurar Economia'}
            </Button>
          </div>
          {economics.isConfigured && (
            <div className="mt-4 p-3 bg-primary/5 rounded-lg text-sm text-center">
              <p className="text-muted-foreground">
                Baseado no seu ticket médio de <span className="font-semibold text-foreground">{formatCurrency(economics.averageTicket || 0)}</span> e 
                taxa de fechamento de <span className="font-semibold text-foreground">{economics.closingRate}%</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Valor por oportunidade comercial: {formatCurrency(economics.opportunityValue)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mission Statement */}
      <Card className="bg-gradient-to-r from-primary/5 to-purple-500/5 border-primary/20">
        <CardContent className="p-6 text-center">
          <p className="text-lg text-foreground italic">
            "Nosso trabalho é colocar sua empresa na frente do cliente certo.<br/>
            <span className="font-semibold">Cada leitura é uma vitória. Cada clique no CTA é uma oportunidade.</span>"
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
