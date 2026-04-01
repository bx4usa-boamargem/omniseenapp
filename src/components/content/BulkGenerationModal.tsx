import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Loader2,
  Zap,
  Crown,
  Layers,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface BulkGenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blogId: string;
}

interface JobProgress {
  id: string;
  status: string;
  total_articles: number | null;
  completed_articles: number | null;
  failed_articles: number | null;
}

export function BulkGenerationModal({
  open,
  onOpenChange,
  blogId,
}: BulkGenerationModalProps) {
  const [topics, setTopics] = useState("");
  const [mode, setMode] = useState<"economic" | "premium">("economic");
  const [submitting, setSubmitting] = useState(false);
  const [activeJob, setActiveJob] = useState<JobProgress | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const topicList = topics
    .split("\n")
    .map((t) => t.trim())
    .filter(Boolean);

  const handleSubmit = async () => {
    if (topicList.length === 0) {
      toast.error("Adicione pelo menos um tópico.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-generation-job",
        {
          body: {
            blog_id: blogId,
            topics: topicList,
            mode,
            job_type: "bulk",
          },
        }
      );
      if (error) throw error;
      if (data?.job_id) {
        setActiveJob({
          id: data.job_id,
          status: "pending",
          total_articles: topicList.length,
          completed_articles: 0,
          failed_articles: 0,
        });
        toast.success(`Job criado com ${topicList.length} tópicos!`);
      } else {
        toast.success(data?.message || "Job criado!");
      }
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "falha ao criar job"));
    } finally {
      setSubmitting(false);
    }
  };

  // Poll job progress
  useEffect(() => {
    if (!activeJob?.id) return;

    const poll = async () => {
      const { data } = await supabase
        .from("generation_jobs")
        .select("id, status, public_progress, public_stage, public_message")
        .eq("id", activeJob.id)
        .single();
      if (data) {
        const progress = (data as any).public_progress || 0;
        const isDone = data.status === "completed" || data.status === "failed";
        setActiveJob({
          id: data.id,
          status: data.status,
          total_articles: topicList.length,
          completed_articles: Math.round((progress / 100) * topicList.length),
          failed_articles: data.status === "failed" ? 1 : 0,
        });
        if (isDone && pollingRef.current) {
          clearInterval(pollingRef.current);
        }
      }
    };

    pollingRef.current = setInterval(poll, 5000);
    poll();

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeJob?.id]);

  const handleClose = (val: boolean) => {
    if (!val) {
      setActiveJob(null);
      setTopics("");
    }
    onOpenChange(val);
  };

  const completed = activeJob?.completed_articles || 0;
  const failed = activeJob?.failed_articles || 0;
  const total = activeJob?.total_articles || 1;
  const progressPct = Math.round(((completed + failed) / total) * 100);
  const isRunning =
    activeJob &&
    activeJob.status !== "completed" &&
    activeJob.status !== "failed" &&
    activeJob.status !== "done";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Geração em Massa
          </DialogTitle>
        </DialogHeader>

        {!activeJob ? (
          <div className="space-y-5 py-2">
            {/* Topics input */}
            <div className="space-y-2">
              <Label>Tópicos (um por linha)</Label>
              <Textarea
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                placeholder={`Como escolher um advogado trabalhista\nDireitos do consumidor em compras online\nO que fazer após um acidente de trânsito`}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {topicList.length} tópico{topicList.length !== 1 ? "s" : ""}{" "}
                detectado{topicList.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Mode selector */}
            <div className="space-y-2">
              <Label>Modo de Geração</Label>
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as "economic" | "premium")}
                className="grid grid-cols-2 gap-3"
              >
                <label
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    mode === "economic"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value="economic" className="sr-only" />
                  <Zap className="h-6 w-6 text-primary" />
                  <span className="font-semibold text-sm">Econômico</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Mais rápido e acessível
                  </span>
                </label>
                <label
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    mode === "premium"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value="premium" className="sr-only" />
                  <Crown className="h-6 w-6 text-primary" />
                  <span className="font-semibold text-sm">Premium</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Máxima qualidade
                  </span>
                </label>
              </RadioGroup>
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || topicList.length === 0}
              className="w-full gap-2"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Layers className="h-4 w-4" />
              )}
              Gerar {topicList.length} Artigo{topicList.length !== 1 ? "s" : ""}
            </Button>
          </div>
        ) : (
          /* Progress panel */
          <div className="space-y-5 py-4">
            <div className="text-center space-y-2">
              {isRunning ? (
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              ) : activeJob.status === "completed" || activeJob.status === "done" ? (
                <CheckCircle2 className="h-8 w-8 mx-auto text-green-500" />
              ) : (
                <XCircle className="h-8 w-8 mx-auto text-destructive" />
              )}
              <p className="font-semibold">
                {isRunning
                  ? "Gerando artigos..."
                  : activeJob.status === "completed" || activeJob.status === "done"
                  ? "Geração concluída!"
                  : "Geração finalizada com erros"}
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Progresso</span>
                <span>{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-3" />
            </div>

            {/* Counters */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-lg font-bold">{total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-green-500" />
                <p className="text-lg font-bold text-green-600">{completed}</p>
                <p className="text-xs text-muted-foreground">Gerados</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10">
                <XCircle className="h-4 w-4 mx-auto mb-1 text-destructive" />
                <p className="text-lg font-bold text-destructive">{failed}</p>
                <p className="text-xs text-muted-foreground">Falharam</p>
              </div>
            </div>

            {/* Close button */}
            {!isRunning && (
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                className="w-full"
              >
                Fechar
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
