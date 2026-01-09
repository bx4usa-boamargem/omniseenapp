import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, Settings, Play, Pause, Loader2, Rocket, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AutomationCardProps {
  blogId: string;
  compact?: boolean;
}

interface AutomationSettings {
  id: string;
  is_active: boolean;
  frequency: string;
  articles_per_period: number;
}

type QueueStatus = "pending" | "generating" | "generated" | "published" | "failed" | string;

type QueueSummary = {
  active: boolean;
  activeLabel: string;
  lastArticleId: string | null;
};

export function AutomationCard({ blogId, compact = false }: AutomationCardProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [automation, setAutomation] = useState<AutomationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);
  const [queueSummary, setQueueSummary] = useState<QueueSummary>({
    active: false,
    activeLabel: "",
    lastArticleId: null,
  });

  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    const fetchAutomation = async () => {
      try {
        const { data } = await supabase
          .from("blog_automation")
          .select("id, is_active, frequency, articles_per_period")
          .eq("blog_id", blogId)
          .single();

        setAutomation(data);
      } catch (error) {
        console.error("Error fetching automation:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAutomation();
  }, [blogId]);

  const fetchQueueSummary = async () => {
    try {
      const { data, error } = await supabase
        .from("article_queue")
        .select("id, status, scheduled_for, article_id, updated_at")
        .eq("blog_id", blogId)
        .order("created_at", { ascending: false })
        .limit(15);

      if (error) throw error;

      const rows = (data || []) as Array<{
        id: string;
        status: QueueStatus | null;
        scheduled_for: string | null;
        article_id: string | null;
        updated_at: string | null;
      }>;

      const now = Date.now();
      const thirtyMinutesAgo = now - 30 * 60 * 1000;
      
      // Filter out items stuck in "generating" for more than 30 minutes (treat as failed)
      const generating = rows.filter((r) => {
        if (r.status !== "generating") return false;
        const updatedAt = r.updated_at ? new Date(r.updated_at).getTime() : 0;
        return updatedAt > thirtyMinutesAgo; // Only count if updated within last 30 min
      });
      
      const pendingDue = rows.filter(
        (r) =>
          r.status === "pending" &&
          r.scheduled_for &&
          new Date(r.scheduled_for).getTime() <= now
      );

      const active = generating.length > 0 || pendingDue.length > 0;

      const lastArticleId =
        rows.find((r) => (r.status === "generated" || r.status === "published") && r.article_id)?.article_id ||
        null;

      const activeLabel = generating.length > 0
        ? `Gerando ${generating.length} artigo${generating.length > 1 ? "s" : ""}...`
        : pendingDue.length > 0
          ? `Na fila para gerar (${pendingDue.length})...`
          : "";

      setQueueSummary({ active, activeLabel, lastArticleId });
    } catch (e) {
      console.error("Error fetching queue summary:", e);
    }
  };

  useEffect(() => {
    fetchQueueSummary();
  }, [blogId]);

  useEffect(() => {
    const channel = supabase
      .channel(`automation-queue-${blogId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "article_queue",
          filter: `blog_id=eq.${blogId}`,
        },
        () => {
          if (refreshTimer.current) {
            window.clearTimeout(refreshTimer.current);
          }
          refreshTimer.current = window.setTimeout(() => {
            fetchQueueSummary();
          }, 400);
        }
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) {
        window.clearTimeout(refreshTimer.current);
      }
      supabase.removeChannel(channel);
    };
  }, [blogId]);

  const isBusy = useMemo(() => running || toggling || queueSummary.active, [running, toggling, queueSummary.active]);

  const toggleAutomation = async () => {
    if (!automation) return;

    setToggling(true);
    try {
      const { error } = await supabase
        .from("blog_automation")
        .update({ is_active: !automation.is_active })
        .eq("id", automation.id);

      if (error) throw error;

      setAutomation((prev) => (prev ? { ...prev, is_active: !prev.is_active } : null));

      toast({
        title: automation.is_active ? "Automação pausada" : "Automação ativada",
        description: automation.is_active
          ? "A geração automática foi pausada."
          : "Artigos serão gerados automaticamente.",
      });
    } catch (error) {
      console.error("Error toggling automation:", error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar a automação.",
        variant: "destructive",
      });
    } finally {
      setToggling(false);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      // Use supabase.functions.invoke for consistency
      const { data: scheduleData, error: scheduleError } = await supabase.functions.invoke('schedule-articles', {
        body: { immediate: true }
      });

      if (scheduleError) {
        console.error('Schedule error:', scheduleError);
        throw new Error(scheduleError.message || 'Failed to schedule articles');
      }

      const { data: processData, error: processError } = await supabase.functions.invoke('process-queue', {
        body: {}
      });

      if (processError) {
        console.error('Process error:', processError);
        throw new Error(processError.message || 'Failed to process queue');
      }

      await fetchQueueSummary();

      toast({
        title: "Execução concluída!",
        description: `${scheduleData?.scheduled || 0} artigos colocados na fila, ${processData?.processed || 0} processados.`,
      });

      // Navigate to the latest article if available
      const { data: latestArticle } = await supabase
        .from("articles")
        .select("id")
        .eq("blog_id", blogId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestArticle?.id) {
        setQueueSummary((prev) => ({ ...prev, lastArticleId: latestArticle.id }));
        navigate(`/app/articles/${latestArticle.id}`);
      }
    } catch (error) {
      console.error("Error running automation:", error);
      
      // Check for specific error types
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let description = "Não foi possível executar a automação. Tente novamente.";
      
      if (errorMessage.includes('AI_RATE_LIMIT') || errorMessage.includes('429')) {
        description = "Limite de requisições atingido. Aguarde alguns minutos.";
      } else if (errorMessage.includes('AI_CREDITS') || errorMessage.includes('402')) {
        description = "Créditos insuficientes. Adicione créditos para continuar.";
      }
      
      toast({
        title: "Erro na execução",
        description,
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const getFrequencyLabel = (freq: string) => {
    switch (freq) {
      case "daily":
        return "Diário";
      case "weekly":
        return "Semanal";
      case "biweekly":
        return "Quinzenal";
      case "monthly":
        return "Mensal";
      default:
        return freq;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="animate-pulse h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  // Compact version for dashboard 70/30 layout
  if (compact) {
    return (
      <Card className={automation?.is_active ? "border-primary/50 bg-primary/5" : ""}>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className={`h-4 w-4 ${automation?.is_active ? "text-primary" : "text-muted-foreground"}`} />
              <span className="font-medium text-sm">Automação</span>
            </div>
            {automation && (
              <Badge variant={automation.is_active ? "default" : "secondary"} className="text-xs">
                {automation.is_active ? "Ativa" : "Pausada"}
              </Badge>
            )}
          </div>
          
          {queueSummary.active && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="truncate">{queueSummary.activeLabel}</span>
            </div>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
            onClick={() => navigate("/app/automation")}
          >
            <Settings className="h-3 w-3 mr-1" />
            Configurar Automação
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={automation?.is_active ? "border-primary/50 bg-primary/5" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className={`h-5 w-5 ${automation?.is_active ? "text-primary" : "text-muted-foreground"}`} />
            Automação
          </CardTitle>
          {automation && (
            <Badge variant={automation.is_active ? "default" : "secondary"}>
              {automation.is_active ? "Ativa" : "Pausada"}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {automation ? (
          <>
            <div className="text-sm text-muted-foreground space-y-2">
              {queueSummary.active ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>{queueSummary.activeLabel}</span>
                </div>
              ) : automation.is_active ? (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span>
                    Gerando {automation.articles_per_period} artigo{automation.articles_per_period > 1 ? "s" : ""} {getFrequencyLabel(automation.frequency).toLowerCase()}
                  </span>
                </div>
              ) : (
                <span>Configure para gerar artigos automaticamente</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={automation.is_active ? "outline" : "default"}
                size="sm"
                onClick={toggleAutomation}
                disabled={toggling || running}
              >
                {automation.is_active ? (
                  <>
                    <Pause className="h-4 w-4 mr-1" />
                    Pausar
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1" />
                    Ativar
                  </>
                )}
              </Button>

              {automation.is_active && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleRunNow}
                  disabled={running || toggling}
                >
                  {running ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Executando...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4 mr-1" />
                      Executar Agora
                    </>
                  )}
                </Button>
              )}

              {queueSummary.lastArticleId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/app/articles/${queueSummary.lastArticleId}`)}
                  disabled={isBusy}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Ver último artigo
                </Button>
              )}

              <Button variant="ghost" size="sm" onClick={() => navigate("/app/automation")}>
                <Settings className="h-4 w-4 mr-1" />
                Configurar
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Gere artigos automaticamente sem precisar fazer nada</p>
            <Button onClick={() => navigate("/app/automation")}> 
              <Zap className="h-4 w-4 mr-2" />
              Configurar Automação
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
