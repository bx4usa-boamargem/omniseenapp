import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SearchConsoleMetricsBar } from '@/components/consultant/SearchConsoleMetricsBar';
import { SearchConsoleTable } from '@/components/consultant/SearchConsoleTable';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

type ChartGranularity = 'daily' | 'weekly' | 'monthly';

export function SearchPerformanceTab({ blogId, period }: SearchPerformanceTabProps) {
  const [gscMetrics, setGscMetrics] = useState<GSCMetrics>({
    impressions: 0,
    clicks: 0,
    ctr: 0,
    position: 0,
    impressionsDelta: 0,
    clicksDelta: 0
  });
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartGranularity, setChartGranularity] = useState<ChartGranularity>('daily');

  useEffect(() => {
    if (!blogId) return;
    fetchData();
  }, [blogId, period]);

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

        const impressionsDelta = secondHalfImpressions - firstHalfImpressions;
        const clicksDelta = secondHalfClicks - firstHalfClicks;

        setGscMetrics({
          impressions: totalImpressions,
          clicks: totalClicks,
          ctr: avgCtr,
          position: avgPosition,
          impressionsDelta,
          clicksDelta
        });

        // Aggregate by date for chart
        const dateMap = new Map<string, { impressions: number; clicks: number }>();
        gscData.forEach(d => {
          const existing = dateMap.get(d.date) || { impressions: 0, clicks: 0 };
          dateMap.set(d.date, {
            impressions: existing.impressions + (d.impressions || 0),
            clicks: existing.clicks + (d.clicks || 0)
          });
        });

        const chartData = Array.from(dateMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, data]) => ({
            date: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
            impressions: data.impressions,
            clicks: data.clicks
          }));
        
        setHistoricalData(chartData);
      }
    } catch (error) {
      console.error('Error fetching search performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = () => {
    const endDate = new Date();
    const startDate = new Date();
    const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    startDate.setDate(startDate.getDate() - daysAgo);
    
    return `${startDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${endDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  };

  const getAggregatedChartData = () => {
    if (chartGranularity === 'daily') return historicalData;
    
    const weeklyData: { [key: string]: { impressions: number; clicks: number; count: number } } = {};
    
    historicalData.forEach((item, index) => {
      const weekIndex = Math.floor(index / 7);
      const key = `Sem ${weekIndex + 1}`;
      
      if (!weeklyData[key]) {
        weeklyData[key] = { impressions: 0, clicks: 0, count: 0 };
      }
      weeklyData[key].impressions += item.impressions;
      weeklyData[key].clicks += item.clicks;
      weeklyData[key].count++;
    });

    return Object.entries(weeklyData).map(([date, data]) => ({
      date,
      impressions: data.impressions,
      clicks: data.clicks
    }));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-20 bg-muted rounded"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold text-foreground">
          Performance de Busca
        </h2>
        <p className="text-sm text-muted-foreground">
          Acompanhe o desempenho do tráfego orgânico do seu blog
        </p>
      </div>

      {/* Metrics Bar - Google Search Console Style */}
      <SearchConsoleMetricsBar
        clicks={gscMetrics.clicks}
        impressions={gscMetrics.impressions}
        ctr={gscMetrics.ctr}
        position={gscMetrics.position}
        clicksDelta={gscMetrics.clicksDelta}
        impressionsDelta={gscMetrics.impressionsDelta}
        periodLabel={getPeriodLabel()}
      />

      {/* Main Chart */}
      <div className="bg-card border border-border rounded-lg">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-medium text-foreground">
            Evolução do Tráfego Orgânico
          </h3>
          <Select 
            value={chartGranularity} 
            onValueChange={(v: ChartGranularity) => setChartGranularity(v)}
          >
            <SelectTrigger className="w-28 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Diário</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="p-4">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={getAggregatedChartData()}>
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}K` : value}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}K` : value}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '12px' }}
                  iconType="circle"
                  iconSize={8}
                />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="clicks" 
                  name="Cliques"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#3b82f6' }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="impressions" 
                  name="Impressões"
                  stroke="#ec4899"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#ec4899' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Pages Table */}
      {blogId && (
        <SearchConsoleTable blogId={blogId} period={period} />
      )}
    </div>
  );
}
