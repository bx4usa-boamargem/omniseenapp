import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { 
  MousePointer, 
  Eye, 
  Target, 
  TrendingUp, 
  TrendingDown,
  Lightbulb,
  Trophy,
  AlertTriangle
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface PerformanceData {
  aggregated: {
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
  };
  positionDistribution: {
    top3: { count: number; percentage: number };
    positions4_10: { count: number; percentage: number };
    positions11_20: { count: number; percentage: number };
    positions21_50: { count: number; percentage: number };
    positions51_100: { count: number; percentage: number };
  };
  dailyData: any[];
  topQueries: any[];
  topPages: any[];
}

interface GSCOmniseenTabProps {
  data: PerformanceData | null;
  isLoading: boolean;
}

const COLORS = ['hsl(var(--primary))', '#22c55e', '#eab308', '#f97316', '#ef4444'];

export function GSCOmniseenTab({ data, isLoading }: GSCOmniseenTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhum dado disponível. Clique em "Sincronizar" para buscar dados.
        </CardContent>
      </Card>
    );
  }

  const { aggregated, positionDistribution, dailyData, topQueries, topPages } = data;

  // Generate insights
  const insights = [];
  
  if (aggregated.avgPosition <= 10) {
    insights.push({
      type: 'success',
      icon: Trophy,
      text: `Excelente! Sua posição média (${aggregated.avgPosition.toFixed(1)}) está na primeira página do Google.`
    });
  } else if (aggregated.avgPosition <= 20) {
    insights.push({
      type: 'warning',
      icon: AlertTriangle,
      text: `Sua posição média (${aggregated.avgPosition.toFixed(1)}) está na segunda página. Otimize conteúdo para subir.`
    });
  }

  if (aggregated.avgCtr > 3) {
    insights.push({
      type: 'success',
      icon: TrendingUp,
      text: `CTR acima da média (${aggregated.avgCtr.toFixed(2)}%). Seus títulos estão atraentes!`
    });
  } else if (aggregated.avgCtr < 1.5) {
    insights.push({
      type: 'warning',
      icon: Lightbulb,
      text: `CTR baixo (${aggregated.avgCtr.toFixed(2)}%). Considere melhorar títulos e meta descriptions.`
    });
  }

  const nearTop10 = topQueries.filter((q: any) => q.position > 10 && q.position <= 20).length;
  if (nearTop10 > 0) {
    insights.push({
      type: 'opportunity',
      icon: Lightbulb,
      text: `${nearTop10} palavras-chave estão próximas do Top 10. Oportunidade de crescimento rápido!`
    });
  }

  const pieData = [
    { name: 'Top 3', value: positionDistribution.top3.count },
    { name: '4-10', value: positionDistribution.positions4_10.count },
    { name: '11-20', value: positionDistribution.positions11_20.count },
    { name: '21-50', value: positionDistribution.positions21_50.count },
    { name: '51-100', value: positionDistribution.positions51_100.count },
  ].filter(item => item.value > 0);

  // Calculate SEO Score
  const seoScore = Math.min(100, Math.round(
    (aggregated.avgPosition <= 10 ? 40 : aggregated.avgPosition <= 20 ? 25 : 10) +
    (aggregated.avgCtr >= 3 ? 30 : aggregated.avgCtr >= 1.5 ? 20 : 10) +
    (positionDistribution.top3.percentage >= 10 ? 30 : positionDistribution.top3.percentage >= 5 ? 20 : 10)
  ));

  return (
    <div className="space-y-6">
      {/* Source Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          ✨ Powered by Google Search Console
        </Badge>
        <span className="text-xs text-muted-foreground">Análise aprimorada Omniseen</span>
      </div>

      {/* Hero Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        {/* SEO Score */}
        <Card className="md:col-span-1 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">SEO Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(seoScore / 100) * 251.2} 251.2`}
                    className="text-primary"
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold">{seoScore}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cliques</CardTitle>
            <MousePointer className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregated.totalClicks.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Últimos 28 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Impressões</CardTitle>
            <Eye className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregated.totalImpressions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Exibições no Google</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CTR</CardTitle>
            <Target className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregated.avgCtr.toFixed(2)}%</div>
            <Progress value={Math.min(aggregated.avgCtr * 10, 100)} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Posição</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregated.avgPosition.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">
              {aggregated.avgPosition <= 10 ? '🎉 Primeira página!' : 'Otimize para subir'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              Insights Automáticos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <div 
                  key={index} 
                  className={`flex items-start gap-3 p-3 rounded-lg ${
                    insight.type === 'success' ? 'bg-green-50 dark:bg-green-950/20' :
                    insight.type === 'warning' ? 'bg-yellow-50 dark:bg-yellow-950/20' :
                    'bg-blue-50 dark:bg-blue-950/20'
                  }`}
                >
                  <insight.icon className={`h-5 w-5 mt-0.5 ${
                    insight.type === 'success' ? 'text-green-600' :
                    insight.type === 'warning' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`} />
                  <span className="text-sm">{insight.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Traffic Evolution */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução do Tráfego Orgânico</CardTitle>
            <CardDescription>Tendência de cliques e impressões</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData}>
                  <defs>
                    <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getDate()}/${date.getMonth() + 1}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="clicks" 
                    name="Cliques"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorClicks)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Position Distribution Pie */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Posições</CardTitle>
            <CardDescription>Palavras-chave por faixa de ranking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm">{entry.name}: {entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Opportunities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Oportunidades de Crescimento
          </CardTitle>
          <CardDescription>
            Palavras-chave próximas do Top 10 com potencial de crescimento rápido
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topQueries
              .filter((q: any) => q.position > 10 && q.position <= 25)
              .slice(0, 5)
              .map((query: any, index: number) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{query.query}</p>
                    <p className="text-sm text-muted-foreground">
                      {query.impressions.toLocaleString()} impressões • {query.clicks} cliques
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className="mb-1">
                      Posição {query.position.toFixed(0)}
                    </Badge>
                    <p className="text-xs text-green-600">
                      Potencial: Top 10 🎯
                    </p>
                  </div>
                </div>
              ))}
            {topQueries.filter((q: any) => q.position > 10 && q.position <= 25).length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                Todas as suas palavras-chave principais já estão bem posicionadas! 🎉
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
