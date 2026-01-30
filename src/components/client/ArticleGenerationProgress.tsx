/**
 * Article Generation Progress Component
 * 
 * Exibe progresso visual da geração de artigos com etapas do Article Engine.
 */

import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Brain, 
  LayoutTemplate, 
  Search, 
  FileText, 
  Target, 
  CheckCircle2,
  Loader2,
  Circle,
  Clock,
  AlertTriangle,
  ListTree,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface GenerationStage {
  key: string;
  label: string;
  icon: LucideIcon;
  progress: number;
}

const GENERATION_STAGES: GenerationStage[] = [
  { key: 'classifying', label: 'Classificando intenção...', icon: Brain, progress: 10 },
  { key: 'selecting', label: 'Selecionando template...', icon: LayoutTemplate, progress: 20 },
  { key: 'researching', label: 'Pesquisando na web...', icon: Search, progress: 40 },
  { key: 'outlining', label: 'Gerando estrutura...', icon: ListTree, progress: 55 },
  { key: 'writing', label: 'Escrevendo conteúdo...', icon: FileText, progress: 75 },
  { key: 'optimizing', label: 'Otimizando SEO...', icon: Target, progress: 90 },
];

interface ArticleGenerationProgressProps {
  currentStage: string | null;
  progress: number;
  showTimeoutWarning?: boolean;
  keyword: string;
  onCancel?: () => void;
}

export function ArticleGenerationProgress({ 
  currentStage, 
  progress,
  showTimeoutWarning = false,
  keyword,
  onCancel
}: ArticleGenerationProgressProps) {
  const currentStageIndex = GENERATION_STAGES.findIndex(s => s.key === currentStage);
  
  return (
    <div className="bg-card border rounded-2xl shadow-2xl p-8 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="space-y-3 text-center">
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Brain className="h-6 w-6 text-primary animate-pulse" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            Gerando Artigo de Autoridade Local
          </h2>
          {keyword && (
            <p className="text-sm text-primary font-medium mt-1">
              "{keyword}"
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Tempo estimado: 1-2 minutos</span>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary via-primary/80 to-primary transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progress}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          </div>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-semibold text-foreground">{Math.round(progress)}%</span>
        </div>
      </div>
      
      {/* Stages List */}
      <div className="space-y-2">
        {GENERATION_STAGES.map((stage, index) => {
          const isPast = index < currentStageIndex;
          const isCurrent = index === currentStageIndex;
          const isFuture = index > currentStageIndex;
          const Icon = stage.icon;
          
          return (
            <div 
              key={stage.key}
              className={cn(
                "flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg transition-all duration-300",
                isPast && "bg-green-500/10",
                isCurrent && "bg-primary/10 border border-primary/30",
                isFuture && "opacity-50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center transition-all",
                  isPast && "bg-green-500 text-white",
                  isCurrent && "bg-primary text-primary-foreground",
                  isFuture && "bg-muted text-muted-foreground"
                )}>
                  {isPast ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isCurrent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                
                <span className={cn(
                  "text-sm font-medium transition-colors",
                  isPast && "text-green-600 dark:text-green-400",
                  isCurrent && "text-foreground",
                  isFuture && "text-muted-foreground"
                )}>
                  {stage.label}
                </span>
              </div>

              <div className="flex items-center">
                {isPast && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    ✓ Concluído
                  </span>
                )}
                {isCurrent && (
                  <span className="text-xs text-primary font-medium animate-pulse">
                    Em andamento...
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Timeout Warning */}
      {showTimeoutWarning && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Geração está demorando mais que o esperado. Aguarde mais um momento...
          </p>
        </div>
      )}
      
      {/* Cancel Button */}
      {onCancel && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="gap-2 text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
