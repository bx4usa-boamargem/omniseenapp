import { useState, useCallback } from "react";
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
  ChevronDown,
  RefreshCw,
  TrendingUp,
  Search,
  FileText,
  BookOpen,
  Link2,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ScoreBreakdown {
  overall_score?: number;
  grade?: string;
  keyword_score?: number;
  structure_score?: number;
  readability_score?: number;
  geo_score?: number;
  internal_links_score?: number;
}

interface DualScorePanelProps {
  articleId: string;
  seoScoreBreakdown: ScoreBreakdown | null;
  onRefresh: () => void;
}

const gradeConfig: Record<string, { color: string; label: string }> = {
  Exceptional: { color: "bg-green-500/20 text-green-600 border-green-500/30", label: "Excepcional" },
  Strong: { color: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30", label: "Forte" },
  Good: { color: "bg-blue-500/20 text-blue-600 border-blue-500/30", label: "Bom" },
  "Needs Work": { color: "bg-yellow-500/20 text-yellow-600 border-yellow-500/30", label: "Melhorar" },
  Rewrite: { color: "bg-destructive/20 text-destructive border-destructive/30", label: "Reescrever" },
};

function ScoreCircle({ 
  score, 
  label, 
  icon, 
  colorClass 
}: { 
  score: number; 
  label: string; 
  icon: React.ReactNode; 
  colorClass: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <div className={cn(
        "relative w-20 h-20 rounded-full border-4 flex items-center justify-center",
        colorClass
      )}>
        <span className="text-2xl font-bold">{score}</span>
      </div>
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
    </div>
  );
}

function SubScoreRow({ 
  label, 
  score, 
  icon 
}: { 
  label: string; 
  score: number; 
  icon: React.ReactNode;
}) {
  const getBarColor = (s: number) => {
    if (s >= 80) return "bg-green-500";
    if (s >= 60) return "bg-yellow-500";
    return "bg-destructive";
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="font-medium">{score}/100</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", getBarColor(score))}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function DualScorePanel({
  articleId,
  seoScoreBreakdown,
  onRefresh,
}: DualScorePanelProps) {
  const [calculating, setCalculating] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const breakdown = seoScoreBreakdown || {} as ScoreBreakdown;
  const seoScore = breakdown.overall_score ?? 0;
  const geoScore = breakdown.geo_score ?? 0;
  const grade = breakdown.grade || "Needs Work";
  const gradeInfo = gradeConfig[grade] || gradeConfig["Needs Work"];

  const handleRecalculate = async () => {
    setCalculating(true);
    try {
      const { error } = await supabase.functions.invoke("calculate-content-score", {
        body: { article_id: articleId },
      });
      if (error) throw error;
      toast.success("Score recalculado!");
      onRefresh();
    } catch (err: any) {
      toast.error("Erro ao recalcular: " + (err.message || "erro"));
    } finally {
      setCalculating(false);
    }
  };

  const handleBoost = async () => {
    setBoosting(true);
    try {
      const { error } = await supabase.functions.invoke("boost-content-score", {
        body: { article_id: articleId },
      });
      if (error) throw error;
      toast.success("Conteúdo otimizado!");
      onRefresh();
    } catch (err: any) {
      toast.error("Erro ao melhorar: " + (err.message || "erro"));
    } finally {
      setBoosting(false);
    }
  };

  const hasScores = seoScore > 0 || geoScore > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Score do Conteúdo
          </CardTitle>
          {hasScores && (
            <Badge variant="outline" className={gradeInfo.color}>
              {gradeInfo.label}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dual Score Circles */}
        {hasScores ? (
          <div className="flex items-center justify-center gap-6">
            <ScoreCircle
              score={geoScore}
              label="GEO Score"
              icon={<Globe className="h-3 w-3" />}
              colorClass="border-green-500/50 text-green-600"
            />
            <ScoreCircle
              score={seoScore}
              label="SEO Score"
              icon={<Search className="h-3 w-3" />}
              colorClass="border-blue-500/50 text-blue-600"
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Clique em "Re-calcular" para analisar o conteúdo.
          </p>
        )}

        {/* Sub-scores collapsible */}
        {hasScores && (
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center">
              <ChevronDown
                className={cn("h-3 w-3 transition-transform", detailsOpen && "rotate-180")}
              />
              Sub-scores detalhados
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2.5">
              <SubScoreRow
                label="Keywords"
                score={breakdown.keyword_score ?? 0}
                icon={<Search className="h-3 w-3" />}
              />
              <SubScoreRow
                label="Estrutura"
                score={breakdown.structure_score ?? 0}
                icon={<FileText className="h-3 w-3" />}
              />
              <SubScoreRow
                label="Legibilidade"
                score={breakdown.readability_score ?? 0}
                icon={<BookOpen className="h-3 w-3" />}
              />
              <SubScoreRow
                label="Links Internos"
                score={breakdown.internal_links_score ?? 0}
                icon={<Link2 className="h-3 w-3" />}
              />
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={calculating || boosting}
            className="flex-1 gap-1.5"
          >
            {calculating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Re-calcular
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBoost}
            disabled={calculating || boosting}
            className="flex-1 gap-1.5"
          >
            {boosting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <TrendingUp className="h-3.5 w-3.5" />
            )}
            Melhorar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
