import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Target, BarChart3, Sparkles } from "lucide-react";
import { SEOTrendData, SEOTrendResult } from "@/hooks/useSEOTrends";

interface SEOTrendStatsProps {
  data: SEOTrendData[];
  trend: SEOTrendResult;
  currentScore: number;
}

export function SEOTrendStats({ data, trend, currentScore }: SEOTrendStatsProps) {
  // Calculate stats
  const latestData = data.length > 0 ? data[data.length - 1] : null;
  const firstData = data.length > 0 ? data[0] : null;
  const previousScore = firstData?.avgScore || currentScore;
  
  // Count total optimizations in the period
  const totalOptimizations = data.reduce((sum, d) => sum + d.optimizationsCount, 0);
  
  // Calculate articles improved (above 80 now vs start)
  const articlesImproved = latestData && firstData 
    ? latestData.articlesAbove80 - firstData.articlesAbove80 
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
      {/* Score Change Card */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Variação</p>
              <div className="flex items-center gap-2 mt-1">
                {trend.direction === "up" && (
                  <>
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <span className="text-2xl font-bold text-green-600">+{trend.change}</span>
                  </>
                )}
                {trend.direction === "down" && (
                  <>
                    <TrendingDown className="h-5 w-5 text-red-500" />
                    <span className="text-2xl font-bold text-red-600">{trend.change}</span>
                  </>
                )}
                {trend.direction === "stable" && (
                  <>
                    <Minus className="h-5 w-5 text-muted-foreground" />
                    <span className="text-2xl font-bold text-muted-foreground">0</span>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">pontos no período</p>
            </div>
            <div className="p-3 rounded-full bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Score Card */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Score Atual</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold">{currentScore}%</span>
                {previousScore !== currentScore && (
                  <span className="text-xs text-muted-foreground">
                    (era {previousScore}%)
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {currentScore >= 80 ? "Excelente! 🎉" : currentScore >= 60 ? "Bom progresso" : "Pode melhorar"}
              </p>
            </div>
            <div className="p-3 rounded-full bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Articles Improved Card */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Artigos +80%</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold">{latestData?.articlesAbove80 || 0}</span>
                {articlesImproved > 0 && (
                  <span className="text-xs text-green-600 font-medium">
                    (+{articlesImproved} novos)
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                de {latestData?.totalArticles || 0} publicados
              </p>
            </div>
            <div className="p-3 rounded-full bg-green-500/10">
              <Sparkles className="h-5 w-5 text-green-500" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
