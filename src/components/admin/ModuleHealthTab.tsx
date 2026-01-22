import { useModuleHealth } from "@/hooks/useModuleHealth";
import { UserJourneyDiagram } from "./UserJourneyDiagram";
import { RadarHealthCard } from "./RadarHealthCard";
import { AgentHealthCard } from "./AgentHealthCard";
import { SEOHealthCard } from "./SEOHealthCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Activity, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ModuleHealthTab() {
  const { 
    radar, 
    agent, 
    seo, 
    journey, 
    loading, 
    error, 
    refetch 
  } = useModuleHealth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={refetch}>Tentar Novamente</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Saúde dos Módulos
          </h2>
          <p className="text-muted-foreground">
            Visão em tempo real do desempenho de cada módulo da plataforma
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Atualizado: {format(new Date(), "HH:mm", { locale: ptBR })}
          </div>
          <Button variant="outline" size="sm" onClick={refetch}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* User Journey Diagram */}
      <UserJourneyDiagram phases={journey} />

      {/* Module Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Health */}
        <RadarHealthCard
          opportunitiesGenerated={radar.opportunitiesGenerated}
          conversionRate={radar.conversionRate}
          avgScore={radar.avgScore}
          cost7d={radar.cost7d}
          highScoreCount={radar.highScoreCount}
          trend={radar.trend}
        />

        {/* Agent Health */}
        <AgentHealthCard
          activeAgents={agent.activeAgents}
          conversations24h={agent.conversations24h}
          leads7d={agent.leads7d}
          conversionRate={agent.conversionRate}
          tokensUsed={agent.tokensUsed}
          mrrAgents={agent.mrrAgents}
          avgTokensPerConversation={agent.avgTokensPerConversation}
        />

        {/* SEO Health */}
        <SEOHealthCard
          avgScore={seo.avgScore}
          criticalArticles={seo.criticalArticles}
          excellentArticles={seo.excellentArticles}
          qualityGateApproval={seo.qualityGateApproval}
          totalArticles={seo.totalArticles}
          scoreDistribution={seo.scoreDistribution}
        />
      </div>

      {/* Summary Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo Operacional</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-primary">
                {radar.opportunitiesGenerated + agent.leads7d + seo.totalArticles}
              </p>
              <p className="text-sm text-muted-foreground">Ações Totais (7d)</p>
            </div>
            
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-success">
                {((radar.conversionRate + agent.conversionRate + seo.qualityGateApproval) / 3).toFixed(0)}%
              </p>
              <p className="text-sm text-muted-foreground">Eficiência Média</p>
            </div>
            
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold">
                ${(radar.cost7d).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">Custo IA (7d)</p>
            </div>
            
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-3xl font-bold text-success">
                ${agent.mrrAgents}
              </p>
              <p className="text-sm text-muted-foreground">MRR Agentes</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
