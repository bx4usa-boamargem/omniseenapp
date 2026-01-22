import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Bot, MessageCircle, UserPlus, DollarSign, AlertTriangle, Zap, Activity } from "lucide-react";

interface AgentHealthCardProps {
  activeAgents: number;
  conversations24h: number;
  leads7d: number;
  conversionRate: number;
  tokensUsed: number;
  mrrAgents: number;
  avgTokensPerConversation: number;
}

const MAX_DAILY_TOKENS = 50000; // Default limit

export function AgentHealthCard({
  activeAgents,
  conversations24h,
  leads7d,
  conversionRate,
  tokensUsed,
  mrrAgents,
  avgTokensPerConversation,
}: AgentHealthCardProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const tokenUsagePercent = (tokensUsed / MAX_DAILY_TOKENS) * 100;

  // Alerts
  const alerts = [];
  if (conversionRate < 5 && conversations24h > 0) {
    alerts.push({
      type: "warning",
      message: "Taxa de conversão abaixo de 5% - Agente com baixa performance",
    });
  }
  if (tokenUsagePercent > 90) {
    alerts.push({
      type: "critical",
      message: "Uso de tokens acima de 90% - Subcontas próximas do limite",
    });
  }

  // Status badge
  const getStatusBadge = () => {
    if (alerts.some(a => a.type === "critical")) {
      return <Badge variant="destructive">Crítico</Badge>;
    }
    if (alerts.some(a => a.type === "warning")) {
      return <Badge variant="secondary">Atenção</Badge>;
    }
    return <Badge className="bg-success">Saudável</Badge>;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Brand Sales Agent
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Activity className="h-3 w-3" />
              Agentes Ativos
            </div>
            <p className="text-2xl font-bold">{activeAgents}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="h-3 w-3" />
              Conversas (24h)
            </div>
            <p className="text-2xl font-bold">{conversations24h}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <UserPlus className="h-3 w-3" />
              Leads (7d)
            </div>
            <p className="text-2xl font-bold">{leads7d}</p>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              MRR Agentes
            </div>
            <p className="text-2xl font-bold text-success">{formatCurrency(mrrAgents)}</p>
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="p-4 bg-muted/50 rounded-lg space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span>Funil de Conversão</span>
            <Badge variant="outline">{conversionRate.toFixed(1)}%</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-8 bg-primary/20 rounded-l-lg flex items-center justify-center text-xs font-medium">
              {conversations24h} conversas
            </div>
            <div className="text-muted-foreground">→</div>
            <div className="flex-1 h-8 bg-success/20 rounded-r-lg flex items-center justify-center text-xs font-medium">
              {leads7d} leads
            </div>
          </div>
        </div>

        {/* Token Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Tokens Usados Hoje
            </div>
            <span className="text-xs text-muted-foreground">
              {tokensUsed.toLocaleString()} / {MAX_DAILY_TOKENS.toLocaleString()}
            </span>
          </div>
          <Progress 
            value={tokenUsagePercent} 
            className={tokenUsagePercent > 90 ? "bg-destructive/20" : ""}
          />
          <p className="text-xs text-muted-foreground">
            Média por conversa: {Math.round(avgTokensPerConversation).toLocaleString()} tokens
          </p>
        </div>

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
