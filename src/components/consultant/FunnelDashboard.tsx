import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Target, Zap, FileText, CheckCircle, ArrowUpRight, Loader2, Radar } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FunnelDashboardProps {
  blogId: string;
}

interface FunnelMetrics {
  topo: { available: number; converted: number; published: number; avgScore: number };
  meio: { available: number; converted: number; published: number; avgScore: number };
  fundo: { available: number; converted: number; published: number; avgScore: number };
}

interface WeeklyEvolution {
  week: string;
  opportunities: number;
  converted: number;
  published: number;
}

export function FunnelDashboard({ blogId }: FunnelDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<FunnelMetrics>({
    topo: { available: 0, converted: 0, published: 0, avgScore: 0 },
    meio: { available: 0, converted: 0, published: 0, avgScore: 0 },
    fundo: { available: 0, converted: 0, published: 0, avgScore: 0 },
  });
  const [weeklyData, setWeeklyData] = useState<WeeklyEvolution[]>([]);

  useEffect(() => {
    if (blogId) {
      fetchMetrics();
    }
  }, [blogId]);

  async function fetchMetrics() {
    setLoading(true);
    
    try {
      // Buscar todas as oportunidades
      const { data: opportunities } = await supabase
        .from("article_opportunities")
        .select("id, funnel_stage, status, relevance_score, created_at")
        .eq("blog_id", blogId);

      // Buscar artigos com opportunity_id (convertidos do funil)
      const { data: articles } = await supabase
        .from("articles")
        .select("id, funnel_stage, status, opportunity_id")
        .eq("blog_id", blogId)
        .not("opportunity_id", "is", null);

      // Calcular métricas por estágio
      const stages = ['topo', 'meio', 'fundo'] as const;
      const newMetrics: FunnelMetrics = {
        topo: { available: 0, converted: 0, published: 0, avgScore: 0 },
        meio: { available: 0, converted: 0, published: 0, avgScore: 0 },
        fundo: { available: 0, converted: 0, published: 0, avgScore: 0 },
      };

      stages.forEach(stage => {
        const stageOpps = opportunities?.filter(o => o.funnel_stage === stage) || [];
        const available = stageOpps.filter(o => o.status === 'pending' || o.status === 'approved');
        const converted = stageOpps.filter(o => o.status === 'converted');
        const stageArticles = articles?.filter(a => a.funnel_stage === stage) || [];
        const published = stageArticles.filter(a => a.status === 'published');
        
        const scores = stageOpps.map(o => o.relevance_score || 0).filter(s => s > 0);
        const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

        newMetrics[stage] = {
          available: available.length,
          converted: converted.length,
          published: published.length,
          avgScore,
        };
      });

      setMetrics(newMetrics);

      // Calcular evolução semanal (últimas 4 semanas)
      const weeks: WeeklyEvolution[] = [];
      for (let i = 3; i >= 0; i--) {
        const weekStart = subDays(new Date(), i * 7 + 6);
        const weekEnd = subDays(new Date(), i * 7);
        const weekLabel = format(weekEnd, "dd/MM", { locale: ptBR });
        
        const weekOpps = opportunities?.filter(o => {
          const created = new Date(o.created_at);
          return created >= weekStart && created <= weekEnd;
        }) || [];
        
        const weekConverted = weekOpps.filter(o => o.status === 'converted');
        const weekArticles = articles?.filter(a => {
          // Aproximação - artigos criados na mesma semana
          return weekOpps.some(o => o.id === a.opportunity_id);
        }) || [];
        const weekPublished = weekArticles.filter(a => a.status === 'published');

        weeks.push({
          week: weekLabel,
          opportunities: weekOpps.length,
          converted: weekConverted.length,
          published: weekPublished.length,
        });
      }
      
      setWeeklyData(weeks);

    } catch (error) {
      console.error("Error fetching funnel metrics:", error);
    } finally {
      setLoading(false);
    }
  }

  const StageMetricCard = ({ 
    stage, 
    data, 
    color, 
    icon: Icon, 
    label 
  }: { 
    stage: string;
    data: { available: number; converted: number; published: number; avgScore: number };
    color: string;
    icon: any;
    label: string;
  }) => {
    const total = data.available + data.converted;
    const conversionRate = total > 0 ? Math.round((data.converted / total) * 100) : 0;
    const publishRate = data.converted > 0 ? Math.round((data.published / data.converted) * 100) : 0;

    return (
      <Card className={`border-l-4 ${color}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Icon className="h-4 w-4" />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-2xl font-bold">{data.available}</p>
              <p className="text-xs text-muted-foreground">Disponíveis</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{data.converted}</p>
              <p className="text-xs text-muted-foreground">Convertidas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{data.published}</p>
              <p className="text-xs text-muted-foreground">Publicadas</p>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Taxa de conversão</span>
              <span className="font-medium">{conversionRate}%</span>
            </div>
            <Progress value={conversionRate} className="h-1.5" />
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Score médio: {data.avgScore}%</span>
            <span>Publicação: {publishRate}%</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalAvailable = metrics.topo.available + metrics.meio.available + metrics.fundo.available;
  const totalConverted = metrics.topo.converted + metrics.meio.converted + metrics.fundo.converted;
  const totalPublished = metrics.topo.published + metrics.meio.published + metrics.fundo.published;
  const overallConversion = (totalAvailable + totalConverted) > 0 
    ? Math.round((totalConverted / (totalAvailable + totalConverted)) * 100) 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header com totais */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Funil de Conteúdo</h3>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="gap-1">
            <FileText className="h-3 w-3" />
            {totalAvailable} disponíveis
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <ArrowUpRight className="h-3 w-3" />
            {totalConverted} convertidas
          </Badge>
          <Badge className="gap-1 bg-green-600">
            <CheckCircle className="h-3 w-3" />
            {totalPublished} publicadas
          </Badge>
        </div>
      </div>

      {/* Cards por estágio */}
      <div className="grid md:grid-cols-3 gap-4">
        <StageMetricCard
          stage="topo"
          data={metrics.topo}
          color="border-l-orange-500"
          icon={TrendingUp}
          label="Topo do Funil"
        />
        <StageMetricCard
          stage="meio"
          data={metrics.meio}
          color="border-l-purple-500"
          icon={Target}
          label="Meio do Funil"
        />
        <StageMetricCard
          stage="fundo"
          data={metrics.fundo}
          color="border-l-green-500"
          icon={Zap}
          label="Fundo do Funil"
        />
      </div>

      {/* Taxa de conversão geral */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Taxa de Conversão Geral</span>
            <span className="text-lg font-bold text-primary">{overallConversion}%</span>
          </div>
          <Progress value={overallConversion} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {totalConverted} de {totalAvailable + totalConverted} oportunidades convertidas em artigos
          </p>
        </CardContent>
      </Card>

      {/* Evolução semanal */}
      {weeklyData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Evolução Semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {weeklyData.map((week, idx) => (
                <div key={idx} className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">{week.week}</p>
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">{week.opportunities}</span>
                      <span className="text-xs text-muted-foreground"> opps</span>
                    </p>
                    <p className="text-sm text-primary">
                      <span className="font-medium">{week.converted}</span>
                      <span className="text-xs text-muted-foreground"> conv</span>
                    </p>
                    <p className="text-sm text-green-600">
                      <span className="font-medium">{week.published}</span>
                      <span className="text-xs text-muted-foreground"> pub</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
