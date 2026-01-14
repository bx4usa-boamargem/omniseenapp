import { useBlog } from '@/hooks/useBlog';
import { useTerritoryMetrics } from '@/hooks/useTerritoryMetrics';
import { useTerritories } from '@/hooks/useTerritories';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MapPin, 
  Trophy, 
  TrendingUp, 
  TrendingDown,
  Target, 
  Eye, 
  Zap,
  Plus,
  ChevronRight,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  Globe
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';

export default function ClientTerritoryAnalytics() {
  const navigate = useNavigate();
  const { blog } = useBlog();
  const { metrics, topPerformers, highScoreAlerts, loading: metricsLoading } = useTerritoryMetrics(blog?.id);
  const { territories, loading: territoriesLoading, canAdd } = useTerritories(blog?.id);

  const loading = metricsLoading || territoriesLoading;

  // Calculate distribution data for pie chart
  const distributionData = metrics
    .filter(m => m.isActive && m.totalOpportunities > 0)
    .map(m => ({
      name: m.city || m.state || m.country,
      value: m.totalOpportunities,
      highScore: m.highScoreOpportunities,
    }));

  const COLORS = ['#8b5cf6', '#f97316', '#10b981', '#3b82f6', '#ec4899', '#eab308'];

  // Identify underperforming territories (low conversion rate with opportunities)
  const underperforming = metrics
    .filter(m => m.isActive && m.totalOpportunities > 3 && m.conversionRate < 30)
    .slice(0, 3);

  // Identify high potential (high score but low conversion)
  const highPotential = metrics
    .filter(m => m.isActive && m.highScoreOpportunities > 0 && m.conversionRate < 50)
    .slice(0, 3);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const activeMetrics = metrics.filter(m => m.isActive);
  const totalOpportunities = activeMetrics.reduce((sum, m) => sum + m.totalOpportunities, 0);
  const totalConverted = activeMetrics.reduce((sum, m) => sum + m.convertedArticles, 0);
  const avgConversionRate = totalOpportunities > 0 
    ? Math.round((totalConverted / totalOpportunities) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Globe className="h-7 w-7 text-purple-500" />
            Análise Territorial
          </h1>
          <p className="text-muted-foreground mt-1">
            Performance de oportunidades e conversões por região
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {highScoreAlerts > 0 && (
            <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30 gap-1 py-1.5">
              <Zap className="h-4 w-4" />
              {highScoreAlerts} oportunidades de alto score
            </Badge>
          )}
          {canAdd && (
            <Button 
              onClick={() => navigate('/client/company')}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Adicionar Território
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <MapPin className="h-5 w-5 text-purple-500" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold">{activeMetrics.length}</div>
              <div className="text-sm text-muted-foreground">Territórios ativos</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <Target className="h-5 w-5 text-orange-500" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold">{totalOpportunities}</div>
              <div className="text-sm text-muted-foreground">Oportunidades totais</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-green-500/20">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold">{totalConverted}</div>
              <div className="text-sm text-muted-foreground">Artigos convertidos</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <BarChart3 className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-bold">{avgConversionRate}%</div>
              <div className="text-sm text-muted-foreground">Taxa média de conversão</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Performers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Top Performers
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPerformers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum território com conversões ainda
              </p>
            ) : (
              <div className="space-y-4">
                {topPerformers.map((territory, index) => (
                  <div
                    key={territory.territoryId}
                    className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
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
                      <span className="font-medium truncate block">{territory.territoryName}</span>
                      <span className="text-xs text-muted-foreground">
                        {territory.totalOpportunities} opps • {territory.convertedArticles} conv.
                      </span>
                    </div>

                    <div className="text-right">
                      <div className="font-bold text-green-500">{territory.conversionRate}%</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              Distribuição de Oportunidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {distributionData.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum dado para exibir
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={distributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {distributionData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`${value} oportunidades`]}
                    />
                    <Legend 
                      formatter={(value) => <span className="text-foreground text-sm">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Insights - High Potential */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-orange-500" />
              Alto Potencial Inexplorado
            </CardTitle>
          </CardHeader>
          <CardContent>
            {highPotential.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Todos os territórios com alto score estão sendo bem aproveitados! 🎉
              </p>
            ) : (
              <div className="space-y-3">
                {highPotential.map((territory) => (
                  <div
                    key={territory.territoryId}
                    className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{territory.territoryName}</span>
                      <Badge className="bg-orange-500/20 text-orange-600">
                        {territory.highScoreOpportunities} 🔥
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {territory.highScoreOpportunities} oportunidades de alto score (≥90%) com apenas {territory.conversionRate}% de conversão
                    </p>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="mt-2 w-full text-orange-600 hover:text-orange-700"
                      onClick={() => navigate(`/client/radar?territory=${territory.territoryId}`)}
                    >
                      Ver oportunidades
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Underperforming */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Territórios para Atenção
            </CardTitle>
          </CardHeader>
          <CardContent>
            {underperforming.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Nenhum território precisa de atenção especial no momento.
              </p>
            ) : (
              <div className="space-y-3">
                {underperforming.map((territory) => (
                  <div
                    key={territory.territoryId}
                    className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{territory.territoryName}</span>
                      <div className="flex items-center gap-1 text-yellow-600">
                        <TrendingDown className="h-4 w-4" />
                        {territory.conversionRate}%
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {territory.totalOpportunities} oportunidades, mas apenas {territory.convertedArticles} artigos convertidos
                    </p>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="mt-2 w-full text-yellow-600 hover:text-yellow-700"
                      onClick={() => navigate(`/client/radar?territory=${territory.territoryId}`)}
                    >
                      Explorar território
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full Territory Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-purple-500" />
            Todos os Territórios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Território</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Oportunidades</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Alto Score</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Convertidos</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Publicados</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Views</th>
                  <th className="text-center py-3 px-2 font-medium text-muted-foreground">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((territory) => (
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
                    <td className="text-center py-3 px-2">
                      <Badge variant={territory.isActive ? 'default' : 'secondary'}>
                        {territory.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="text-center py-3 px-2">{territory.totalOpportunities}</td>
                    <td className="text-center py-3 px-2">
                      {territory.highScoreOpportunities > 0 ? (
                        <Badge className="bg-orange-500/20 text-orange-600">
                          {territory.highScoreOpportunities}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="text-center py-3 px-2 text-green-500 font-medium">
                      {territory.convertedArticles}
                    </td>
                    <td className="text-center py-3 px-2">{territory.publishedArticles}</td>
                    <td className="text-center py-3 px-2">{territory.totalViews.toLocaleString()}</td>
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
        </CardContent>
      </Card>
    </div>
  );
}
