import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, 
  Trophy, 
  TrendingUp, 
  Target, 
  Eye, 
  ChevronRight,
  Loader2,
  AlertTriangle,
  Zap,
  BarChart3
} from 'lucide-react';
import { useTerritoryMetrics, TerritoryMetrics } from '@/hooks/useTerritoryMetrics';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts';

interface TerritoryMetricsDashboardProps {
  blogId: string;
  className?: string;
}

export function TerritoryMetricsDashboard({ blogId, className }: TerritoryMetricsDashboardProps) {
  const navigate = useNavigate();
  const { metrics, topPerformers, highScoreAlerts, loading, error } = useTerritoryMetrics(blogId);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  // Chart data preparation
  const chartData = useMemo(() => {
    return metrics
      .filter(m => m.isActive)
      .map(m => ({
        name: m.city || m.state || m.country,
        opportunities: m.totalOpportunities,
        converted: m.convertedArticles,
        highScore: m.highScoreOpportunities,
        conversionRate: m.conversionRate,
      }))
      .slice(0, 8); // Limit for visibility
  }, [metrics]);

  // Color palette for chart bars
  const COLORS = ['#8b5cf6', '#f97316', '#10b981', '#3b82f6', '#ec4899', '#eab308', '#06b6d4', '#6366f1'];

  if (loading) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardHeader>
          <div className="h-6 bg-muted rounded w-48" />
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={cn('border-destructive/50', className)}>
        <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
          <AlertTriangle className="h-5 w-5 mr-2" />
          {error}
        </CardContent>
      </Card>
    );
  }

  if (metrics.length === 0) {
    return null; // Don't show if no territories configured
  }

  const activeMetrics = metrics.filter(m => m.isActive);
  const totalOpportunities = activeMetrics.reduce((sum, m) => sum + m.totalOpportunities, 0);
  const totalConverted = activeMetrics.reduce((sum, m) => sum + m.convertedArticles, 0);
  const totalViews = activeMetrics.reduce((sum, m) => sum + m.totalViews, 0);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <MapPin className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Performance por Território</CardTitle>
              <p className="text-sm text-muted-foreground mt-0.5">
                Comparativo de oportunidades e conversões por região
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {highScoreAlerts > 0 && (
              <Badge className="bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30 gap-1">
                <Zap className="h-3 w-3" />
                {highScoreAlerts} alto score
              </Badge>
            )}
            <div className="flex rounded-lg border bg-muted/50 p-0.5">
              {(['7d', '30d', '90d'] as const).map((period) => (
                <Button
                  key={period}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'text-xs h-7 px-3',
                    selectedPeriod === period && 'bg-background shadow-sm'
                  )}
                  onClick={() => setSelectedPeriod(period)}
                >
                  {period}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-foreground">{activeMetrics.length}</div>
            <div className="text-xs text-muted-foreground">Territórios ativos</div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-purple-500">{totalOpportunities}</div>
            <div className="text-xs text-muted-foreground">Total de oportunidades</div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-green-500">{totalConverted}</div>
            <div className="text-xs text-muted-foreground">Artigos convertidos</div>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-orange-500">{totalViews.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Visualizações totais</div>
          </div>
        </div>

        <Tabs defaultValue="ranking" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ranking" className="gap-2">
              <Trophy className="h-4 w-4" />
              Ranking
            </TabsTrigger>
            <TabsTrigger value="chart" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Gráfico
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-2">
              <Target className="h-4 w-4" />
              Detalhes
            </TabsTrigger>
          </TabsList>

          {/* Ranking Tab */}
          <TabsContent value="ranking" className="mt-4">
            <div className="space-y-3">
              {topPerformers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma oportunidade territorial ainda
                </p>
              ) : (
                topPerformers.map((territory, index) => (
                  <div
                    key={territory.territoryId}
                    className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/client/radar?territory=${territory.territoryId}`)}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
                      index === 0 && 'bg-yellow-500/20 text-yellow-600',
                      index === 1 && 'bg-gray-400/20 text-gray-500',
                      index === 2 && 'bg-orange-600/20 text-orange-600',
                      index > 2 && 'bg-muted text-muted-foreground'
                    )}>
                      {index + 1}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">
                          {territory.territoryName}
                        </span>
                        {territory.highScoreOpportunities > 0 && (
                          <Badge variant="secondary" className="bg-orange-500/20 text-orange-600 text-[10px]">
                            {territory.highScoreOpportunities} 🔥
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{territory.totalOpportunities} oportunidades</span>
                        <span>{territory.convertedArticles} convertidos</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-green-500">
                        {territory.conversionRate}%
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase">conversão</div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* Chart Tab */}
          <TabsContent value="chart" className="mt-4">
            {chartData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum dado para exibir
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tick={{ fontSize: 12 }}
                      className="fill-muted-foreground"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number, name: string) => [
                        value,
                        name === 'opportunities' ? 'Oportunidades' : 
                        name === 'converted' ? 'Convertidos' : 'Alto Score'
                      ]}
                    />
                    <Bar dataKey="opportunities" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Oportunidades">
                      {chartData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                    <Bar dataKey="converted" fill="#10b981" radius={[0, 4, 4, 0]} name="Convertidos" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Território</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Opps</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">🔥</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Conv.</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Views</th>
                    <th className="text-center py-3 px-2 font-medium text-muted-foreground">Taxa</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMetrics.map((territory) => (
                    <tr 
                      key={territory.territoryId}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => navigate(`/client/radar?territory=${territory.territoryId}`)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{territory.territoryName}</span>
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">{territory.totalOpportunities}</td>
                      <td className="text-center py-3 px-2">
                        {territory.highScoreOpportunities > 0 ? (
                          <Badge variant="secondary" className="bg-orange-500/20 text-orange-600">
                            {territory.highScoreOpportunities}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="text-center py-3 px-2 text-green-500 font-medium">
                        {territory.convertedArticles}
                      </td>
                      <td className="text-center py-3 px-2">
                        {territory.totalViews.toLocaleString()}
                      </td>
                      <td className="text-center py-3 px-2">
                        <div className="flex items-center gap-2 justify-center">
                          <Progress value={territory.conversionRate} className="w-12 h-2" />
                          <span className="text-xs font-medium">{territory.conversionRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Button */}
        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => navigate('/client/territories')}
          >
            <MapPin className="h-4 w-4" />
            Gerenciar Territórios
            <ChevronRight className="h-4 w-4 ml-auto" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
