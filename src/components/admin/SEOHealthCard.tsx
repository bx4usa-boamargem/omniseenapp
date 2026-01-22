import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, FileCheck, AlertTriangle, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface SEODistribution {
  range: string;
  count: number;
  color: string;
}

interface SEOHealthCardProps {
  avgScore: number;
  criticalArticles: number;
  excellentArticles: number;
  qualityGateApproval: number;
  totalArticles: number;
  scoreDistribution: SEODistribution[];
}

export function SEOHealthCard({
  avgScore,
  criticalArticles,
  excellentArticles,
  qualityGateApproval,
  totalArticles,
  scoreDistribution,
}: SEOHealthCardProps) {
  // Determine health status
  const getHealthStatus = () => {
    if (avgScore < 65 || criticalArticles / totalArticles > 0.2) return "critical";
    if (avgScore < 75 || criticalArticles / totalArticles > 0.1) return "warning";
    return "healthy";
  };

  const healthStatus = getHealthStatus();

  // Alerts
  const alerts = [];
  if (avgScore < 65) {
    alerts.push({
      type: "warning",
      message: "Score médio abaixo de 65 - Qualidade SEO precisa de atenção",
    });
  }
  if (totalArticles > 0 && criticalArticles / totalArticles > 0.2) {
    alerts.push({
      type: "critical",
      message: `${((criticalArticles / totalArticles) * 100).toFixed(0)}% dos artigos com SEO fraco (<60)`,
    });
  }

  // Status badge color
  const getStatusBadge = () => {
    switch (healthStatus) {
      case "critical":
        return <Badge variant="destructive">Crítico</Badge>;
      case "warning":
        return <Badge variant="secondary">Atenção</Badge>;
      default:
        return <Badge className="bg-success">Saudável</Badge>;
    }
  };

  // Score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-destructive";
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            SEO Performance
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Display */}
        <div className="flex items-center justify-center py-4">
          <div className="relative">
            <div className={`text-5xl font-bold ${getScoreColor(avgScore)}`}>
              {Math.round(avgScore)}
            </div>
            <div className="text-xs text-center text-muted-foreground mt-1">
              Score Médio Global
            </div>
          </div>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-destructive/10 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <XCircle className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-xl font-bold text-destructive">{criticalArticles}</p>
            <p className="text-xs text-muted-foreground">Críticos</p>
          </div>
          
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <FileCheck className="h-4 w-4" />
            </div>
            <p className="text-xl font-bold">{totalArticles}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          
          <div className="p-3 bg-success/10 rounded-lg">
            <div className="flex items-center justify-center gap-1 mb-1">
              <CheckCircle className="h-4 w-4 text-success" />
            </div>
            <p className="text-xl font-bold text-success">{excellentArticles}</p>
            <p className="text-xs text-muted-foreground">Excelentes</p>
          </div>
        </div>

        {/* Quality Gate Approval */}
        <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Quality Gate Aprovação</span>
          </div>
          <Badge variant="outline" className="text-lg font-bold">
            {qualityGateApproval.toFixed(0)}%
          </Badge>
        </div>

        {/* Score Distribution Chart */}
        {scoreDistribution.length > 0 && (
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis 
                  dataKey="range" 
                  type="category" 
                  tick={{ fontSize: 10 }}
                  width={50}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--card))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`${value} artigos`, "Quantidade"]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {scoreDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
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
