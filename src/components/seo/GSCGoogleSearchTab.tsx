import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MousePointer, Eye, Target, TrendingUp } from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
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

interface GSCGoogleSearchTabProps {
  data: PerformanceData | null;
  isLoading: boolean;
}

export function GSCGoogleSearchTab({ data, isLoading }: GSCGoogleSearchTabProps) {
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

  const positionChartData = [
    { name: 'Top 3', count: positionDistribution.top3.count, percentage: positionDistribution.top3.percentage },
    { name: '4-10', count: positionDistribution.positions4_10.count, percentage: positionDistribution.positions4_10.percentage },
    { name: '11-20', count: positionDistribution.positions11_20.count, percentage: positionDistribution.positions11_20.percentage },
    { name: '21-50', count: positionDistribution.positions21_50.count, percentage: positionDistribution.positions21_50.percentage },
    { name: '51-100', count: positionDistribution.positions51_100.count, percentage: positionDistribution.positions51_100.percentage },
  ];

  return (
    <div className="space-y-6">
      {/* Source Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          📊 Fonte: Google Search Console
        </Badge>
        <span className="text-xs text-muted-foreground">Dados oficiais do Google</span>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cliques</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregated.totalClicks.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Impressões</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregated.totalImpressions.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CTR Médio</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregated.avgCtr.toFixed(2)}%</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Posição Média</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{aggregated.avgPosition.toFixed(1)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Clicks & Impressions Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Cliques vs Impressões</CardTitle>
            <CardDescription>Evolução nos últimos 28 dias</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getDate()}/${date.getMonth() + 1}`;
                    }}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                  />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="clicks" 
                    name="Cliques"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="impressions" 
                    name="Impressões"
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Position Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Posição</CardTitle>
            <CardDescription>Quantidade de palavras-chave por faixa de ranking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={positionChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={60} />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      if (name === 'count') return [value, 'Palavras-chave'];
                      return [value + '%', 'Percentual'];
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Queries */}
        <Card>
          <CardHeader>
            <CardTitle>Top Consultas</CardTitle>
            <CardDescription>Palavras-chave que geram mais tráfego</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {topQueries.slice(0, 10).map((query: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground w-6">
                      {index + 1}
                    </span>
                    <span className="text-sm truncate max-w-[200px]">{query.query}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground">{query.clicks} cliques</span>
                    <Badge variant="outline" className="text-xs">
                      Pos. {query.position.toFixed(1)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Pages */}
        <Card>
          <CardHeader>
            <CardTitle>Top Páginas</CardTitle>
            <CardDescription>Páginas com melhor desempenho orgânico</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {topPages.slice(0, 10).map((page: any, index: number) => {
                const path = new URL(page.page).pathname;
                return (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-6">
                        {index + 1}
                      </span>
                      <span className="text-sm truncate max-w-[200px]" title={page.page}>
                        {path || '/'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">{page.clicks} cliques</span>
                      <Badge variant="outline" className="text-xs">
                        Pos. {page.position.toFixed(1)}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
