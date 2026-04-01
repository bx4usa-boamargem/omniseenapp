import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
  ChevronDown,
  Wrench,
  Play,
} from "lucide-react";
import { toast } from "sonner";

interface QualityGateCheck {
  name: string;
  passed: boolean;
  message?: string;
}

interface QualityGatePanelProps {
  articleId: string;
  qualityGateStatus: string | null;
  qualityGateAttempts: number | null;
  qualityGateResult: any;
  onRefresh: () => void;
}

const statusConfig: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  passed: {
    icon: <ShieldCheck className="h-5 w-5 text-green-500" />,
    label: "Aprovado",
    color: "bg-green-500/20 text-green-600 border-green-500/30",
  },
  failed: {
    icon: <ShieldAlert className="h-5 w-5 text-destructive" />,
    label: "Reprovado",
    color: "bg-destructive/20 text-destructive border-destructive/30",
  },
  pending: {
    icon: <ShieldQuestion className="h-5 w-5 text-yellow-500" />,
    label: "Pendente",
    color: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  },
};

export function QualityGatePanel({
  articleId,
  qualityGateStatus,
  qualityGateAttempts,
  qualityGateResult,
  onRefresh,
}: QualityGatePanelProps) {
  const [running, setRunning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [checksOpen, setChecksOpen] = useState(false);

  const status = qualityGateStatus || "pending";
  const config = statusConfig[status] || statusConfig.pending;
  const attempts = qualityGateAttempts || 0;

  // Parse checks from result
  const checks: QualityGateCheck[] = (() => {
    if (!qualityGateResult) return [];
    const result = typeof qualityGateResult === "string"
      ? JSON.parse(qualityGateResult)
      : qualityGateResult;
    if (Array.isArray(result?.checks)) return result.checks;
    if (Array.isArray(result)) return result;
    return [];
  })();

  const passedCount = checks.filter((c) => c.passed).length;
  const totalChecks = checks.length;
  const passRate = totalChecks > 0 ? (passedCount / totalChecks) * 100 : 0;

  const handleRunGate = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("quality-gate", {
        body: { article_id: articleId },
      });
      if (error) throw error;
      toast.success(data?.status === "passed" ? "Quality Gate aprovado!" : "Quality Gate concluído");
      onRefresh();
    } catch (err: any) {
      toast.error("Erro ao rodar Quality Gate: " + (err.message || "erro desconhecido"));
    } finally {
      setRunning(false);
    }
  };

  const handleAutoFix = async () => {
    setFixing(true);
    try {
      const { data, error } = await supabase.functions.invoke("auto-fix-article", {
        body: { article_id: articleId },
      });
      if (error) throw error;
      toast.success(data?.message || "Auto-correção aplicada!");
      onRefresh();
    } catch (err: any) {
      toast.error("Erro na auto-correção: " + (err.message || "erro desconhecido"));
    } finally {
      setFixing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {config.icon}
            Quality Gate
          </CardTitle>
          <Badge variant="outline" className={config.color}>
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress bar if checks exist */}
        {totalChecks > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{passedCount}/{totalChecks} critérios</span>
              <span>{Math.round(passRate)}%</span>
            </div>
            <Progress value={passRate} className="h-2" />
          </div>
        )}

        {/* Attempts */}
        {attempts > 0 && (
          <p className="text-xs text-muted-foreground">
            Tentativas: {attempts}
          </p>
        )}

        {/* Checks detail */}
        {checks.length > 0 && (
          <Collapsible open={checksOpen} onOpenChange={setChecksOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
              <ChevronDown
                className={`h-3 w-3 transition-transform ${checksOpen ? "rotate-180" : ""}`}
              />
              Ver critérios
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="space-y-1.5">
                {checks.map((check, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 text-xs p-1.5 rounded bg-muted/50"
                  >
                    <span className="flex-shrink-0 mt-0.5">
                      {check.passed ? "✅" : "❌"}
                    </span>
                    <div className="min-w-0">
                      <span className="font-medium">{check.name}</span>
                      {check.message && (
                        <p className="text-muted-foreground">{check.message}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunGate}
            disabled={running || fixing}
            className="flex-1 gap-1.5"
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Rodar
          </Button>
          {status === "failed" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoFix}
              disabled={running || fixing}
              className="flex-1 gap-1.5"
            >
              {fixing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wrench className="h-3.5 w-3.5" />
              )}
              Auto-corrigir
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
