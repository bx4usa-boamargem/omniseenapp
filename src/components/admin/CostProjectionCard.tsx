import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Calendar, DollarSign } from "lucide-react";
import { useMemo } from "react";

interface CostProjectionCardProps {
  logs: Array<{
    created_at: string;
    estimated_cost_usd: number;
  }>;
  startDate: Date;
  endDate: Date;
}

export function CostProjectionCard({ logs, startDate, endDate }: CostProjectionCardProps) {
  const projections = useMemo(() => {
    if (logs.length === 0) {
      return {
        dailyAverage: 0,
        weeklyProjection: 0,
        monthlyProjection: 0,
        yearlyProjection: 0,
        trend: 0,
        trendDirection: "stable" as const,
      };
    }

    // Calculate total cost in period
    const totalCost = logs.reduce((sum, log) => sum + (log.estimated_cost_usd || 0), 0);
    
    // Calculate days in period
    const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Daily average
    const dailyAverage = totalCost / daysDiff;
    
    // Projections
    const weeklyProjection = dailyAverage * 7;
    const monthlyProjection = dailyAverage * 30;
    const yearlyProjection = dailyAverage * 365;
    
    // Calculate trend (compare first half vs second half of period)
    const midPoint = new Date((startDate.getTime() + endDate.getTime()) / 2);
    const firstHalf = logs.filter(log => new Date(log.created_at) < midPoint);
    const secondHalf = logs.filter(log => new Date(log.created_at) >= midPoint);
    
    const firstHalfCost = firstHalf.reduce((sum, log) => sum + (log.estimated_cost_usd || 0), 0);
    const secondHalfCost = secondHalf.reduce((sum, log) => sum + (log.estimated_cost_usd || 0), 0);
    
    let trend = 0;
    let trendDirection: "up" | "down" | "stable" = "stable";
    
    if (firstHalfCost > 0) {
      trend = ((secondHalfCost - firstHalfCost) / firstHalfCost) * 100;
      trendDirection = trend > 5 ? "up" : trend < -5 ? "down" : "stable";
    }
    
    return {
      dailyAverage,
      weeklyProjection,
      monthlyProjection,
      yearlyProjection,
      trend,
      trendDirection,
    };
  }, [logs, startDate, endDate]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Projeções de Custo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Média Diária */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Média Diária
            </p>
            <p className="text-xl font-bold">{formatCurrency(projections.dailyAverage)}</p>
          </div>
          
          {/* Projeção Semanal */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Projeção Semanal</p>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(projections.weeklyProjection)}
            </p>
          </div>
          
          {/* Projeção Mensal */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Projeção Mensal</p>
            <p className="text-xl font-bold text-primary">
              {formatCurrency(projections.monthlyProjection)}
            </p>
          </div>
          
          {/* Projeção Anual */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Projeção Anual</p>
            <p className="text-xl font-bold text-destructive">
              {formatCurrency(projections.yearlyProjection)}
            </p>
          </div>
        </div>
        
        {/* Tendência */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            {projections.trendDirection === "up" ? (
              <TrendingUp className="h-4 w-4 text-destructive" />
            ) : projections.trendDirection === "down" ? (
              <TrendingDown className="h-4 w-4 text-green-500" />
            ) : (
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm">
              {projections.trendDirection === "up" && (
                <span className="text-destructive">
                  Custos em alta: +{projections.trend.toFixed(1)}% na segunda metade do período
                </span>
              )}
              {projections.trendDirection === "down" && (
                <span className="text-green-500">
                  Custos em queda: {projections.trend.toFixed(1)}% na segunda metade do período
                </span>
              )}
              {projections.trendDirection === "stable" && (
                <span className="text-muted-foreground">
                  Custos estáveis no período analisado
                </span>
              )}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
