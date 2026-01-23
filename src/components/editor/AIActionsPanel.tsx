import { Button } from '@/components/ui/button';
import { 
  Search, 
  Target, 
  Zap, 
  Rocket, 
  Loader2,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIActionsPanelProps {
  onAnalyze: () => void;
  onOptimize: () => void;
  onBoost: () => void;
  onRunTo100: () => void;
  
  analyzing?: boolean;
  optimizing?: boolean;
  boosting?: boolean;
  runningTo100?: boolean;
  
  hasAnalysis?: boolean;
  className?: string;
}

export function AIActionsPanel({
  onAnalyze,
  onOptimize,
  onBoost,
  onRunTo100,
  analyzing = false,
  optimizing = false,
  boosting = false,
  runningTo100 = false,
  hasAnalysis = false,
  className
}: AIActionsPanelProps) {
  const isAnyLoading = analyzing || optimizing || boosting || runningTo100;

  return (
    <div className={cn("space-y-2", className)}>
      <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5" />
        Ações IA
      </h4>

      <div className="space-y-2">
        {/* Analyze Competition */}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={onAnalyze}
          disabled={isAnyLoading}
        >
          {analyzing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          {analyzing ? 'Analisando...' : 'Analisar Concorrência'}
        </Button>

        {/* Optimize for SERP */}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={onOptimize}
          disabled={isAnyLoading || !hasAnalysis}
        >
          {optimizing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Target className="h-4 w-4" />
          )}
          {optimizing ? 'Otimizando...' : 'Otimizar para SERP'}
        </Button>

        {/* Boost Score */}
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={onBoost}
          disabled={isAnyLoading || !hasAnalysis}
        >
          {boosting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Zap className="h-4 w-4" />
          )}
          {boosting ? 'Aumentando...' : 'Aumentar Score'}
        </Button>

        {/* Run to 100 - Primary Action */}
        <Button
          variant="default"
          size="sm"
          className={cn(
            "w-full justify-start gap-2 font-semibold",
            "bg-gradient-to-r from-purple-600 to-indigo-600",
            "hover:from-purple-700 hover:to-indigo-700",
            "text-white shadow-md",
            "transition-all duration-200"
          )}
          onClick={onRunTo100}
          disabled={isAnyLoading || !hasAnalysis}
        >
          {runningTo100 ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" />
          )}
          {runningTo100 ? 'Otimizando para 100...' : 'LEVAR ESTE ARTIGO A 100'}
        </Button>
      </div>
    </div>
  );
}
