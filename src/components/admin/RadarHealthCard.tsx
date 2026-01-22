import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Radar, TrendingUp, Target, DollarSign, AlertTriangle, Zap } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RadarTrend {
  date: string;
  generated: number;
  converted: number;
}

interface RadarHealthCardProps {
  opportunitiesGenerated: number;
  conversionRate: number;
  avgScore: number;
  cost7d: number;
  highScoreCount: number;
  trend: RadarTrend[];
}

export function RadarHealthCard({
  opportunitiesGenerated,
  conversionRate,
  avgScore,
  cost7d,
  highScoreCount,
  trend,
}: RadarHealthCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Alerts
  const alerts = [];
  if (conversionRate < 30) {
    alerts.push({
      type: "warning",
      message: "Taxa de conversão abaixo de 30% - Subcontas não estão aproveitando o Radar",
    });
  }
  if (cost7d > 50) {
    alerts.push({
      type: "critical",
      message: "Custo de IA acima de $50/semana - Revisar consumo",
    });
  }

  // Format trend data for chart
  const chartData = trend.map(t => ({
    ...t,
    date: format(new Date(t.date), "dd/MM", { locale: ptBR }),
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radar className="h-5 w-5 text-primary" />
            Radar de Oportunidades
          </div>
          <Badge variant={conversionRate >= 30 ? "default" : "destructive"}>
            {conversionRate >= 30 ? "Saudável" : "Atenção"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Geradas (7d)
            </div>
            <p className="text-2xl font-bold">{opportunitiesGenerated}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Target className="h-3 w-3" />
              Taxa Conversão
            </div>
            <p className="text-2xl font-bold">{conversionRate.toFixed(1)}%</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Zap className="h-3 w-3" />
              Score Médio
            </div>
            <p className="text-2xl font-bold">{avgScore.toFixed(0)}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              Custo (7d)
            </div>
            <p className="text-2xl font-bold">{formatCurrency(cost7d)}</p>
          </div>
        </div>

        {/* High Score Badge */}
        <div className="flex items-center justify-between p-3 bg-success/10 rounded-lg">
          <span className="text-sm font-medium">Oportunidades High Score (≥70)</span>
          <Badge className="bg-success">{highScoreCount}</Badge>
        </div>

        {/* Trend Chart */}
        {chartData.length > 0 && (
          <div className="h-[180px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="generated"
                  name="Geradas"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.3)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="converted"
                  name="Convertidas"
                  stroke="hsl(var(--success))"
                  fill="hsl(var(--success) / 0.3)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2 pt-2">
            {alerts.map((alert, index) => (
              <Alert key={index} variant={alert.type === "critical" ? "destructive" : "default"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {alert.message}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
