import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { SEOTrendData } from "@/hooks/useSEOTrends";
import { TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";

interface SEOTrendChartProps {
  data: SEOTrendData[];
  isLoading: boolean;
  onPeriodChange: (days: number) => void;
  currentPeriod: number;
}

export function SEOTrendChart({ data, isLoading, onPeriodChange, currentPeriod }: SEOTrendChartProps) {
  const periods = [
    { label: "7d", days: 7 },
    { label: "30d", days: 30 },
    { label: "90d", days: 90 },
  ];

  // Calculate trend for display
  const getTrend = () => {
    if (data.length < 2) return { direction: "stable" as const, change: 0 };
    const first = data[0].avgScore;
    const last = data[data.length - 1].avgScore;
    const change = last - first;
    if (change > 5) return { direction: "up" as const, change };
    if (change < -5) return { direction: "down" as const, change };
    return { direction: "stable" as const, change };
  };

  const trend = getTrend();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolução do SEO
          </CardTitle>
          <CardDescription>Carregando dados...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Evolução do SEO
          </CardTitle>
          <CardDescription>Nenhum dado histórico disponível</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground flex-col gap-3">
            <TrendingUp className="h-12 w-12 opacity-30" />
            <p className="text-center">
              Os dados de evolução começarão a aparecer após você realizar análises de SEO.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Evolução do SEO
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              {trend.direction === "up" && (
                <>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-green-600 font-medium">+{trend.change} pontos</span>
                  <span>no período</span>
                </>
              )}
              {trend.direction === "down" && (
                <>
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-red-600 font-medium">{trend.change} pontos</span>
                  <span>no período</span>
                </>
              )}
              {trend.direction === "stable" && (
                <>
                  <Minus className="h-4 w-4 text-muted-foreground" />
                  <span>Score estável</span>
                </>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            {periods.map((period) => (
              <Button
                key={period.days}
                variant={currentPeriod === period.days ? "default" : "outline"}
                size="sm"
                onClick={() => onPeriodChange(period.days)}
                className="h-7 px-2 text-xs"
              >
                {period.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="formattedDate"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number) => [`${value}%`, "Score SEO"]}
              />
              <ReferenceLine 
                y={80} 
                stroke="hsl(var(--success))" 
                strokeDasharray="5 5" 
                label={{ 
                  value: "Meta (80%)", 
                  position: "right", 
                  fill: "hsl(var(--success))",
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="avgScore"
                name="Score SEO"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorScore)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
