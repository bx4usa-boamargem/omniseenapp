/**
 * Article Generation Progress Component V4.2
 * 
 * Exibe progresso visual da geração de artigos com etapas do Article Engine.
 * Agora com suporte a polling real de estágios e botão de diagnóstico.
 */

import { useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { 
  Brain, 
  Search, 
  FileText, 
  Target, 
  CheckCircle2,
  Loader2,
  Circle,
  Clock,
  AlertTriangle,
  X,
  Activity,
  Image
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { GenerationDiagnosticsDialog } from './GenerationDiagnosticsDialog';

interface GenerationStage {
  key: string;
  label: string;
  icon: LucideIcon;
  progress: number;
}

/**
 * V4.2: Complete stage list matching backend exactly
 */
const GENERATION_STAGES: GenerationStage[] = [
  { key: 'classifying', label: 'Classificando intenção...', icon: Brain, progress: 10 },
  { key: 'researching', label: 'Pesquisando referências...', icon: Search, progress: 30 },
  { key: 'writing', label: 'Escrevendo conteúdo...', icon: FileText, progress: 60 },
  { key: 'seo', label: 'Otimizando SEO...', icon: Target, progress: 75 },
  { key: 'images', label: 'Gerando imagens...', icon: Image, progress: 88 },
  { key: 'finalizing', label: 'Finalizando artigo...', icon: CheckCircle2, progress: 98 },
];

interface DiagnosticsData {
  research?: {
    provider: string;
    durationMs: number;
    success: boolean;
    usedFallback?: boolean;
  };
  writer?: {
    provider: string;
    durationMs: number;
    success: boolean;
  };
  qa?: {
    provider: string;
    durationMs: number;
    score?: number;
  };
  images?: {
    total: number;
    completed: number;
    pending: boolean;
    usedPlaceholders: boolean;
    durationMs?: number;
  };
  totalDurationMs?: number;
}

interface ArticleGenerationProgressProps {
  currentStage: string | null;
  progress: number;
  showTimeoutWarning?: boolean;
  keyword: string;
  onCancel?: () => void;
  isStuck?: boolean;
  stuckDuration?: number;
  diagnostics?: DiagnosticsData | null;
}

export function ArticleGenerationProgress({ 
  currentStage, 
  progress,
  showTimeoutWarning = false,
  keyword,
  onCancel,
  isStuck = false,
  stuckDuration = 0,
  diagnostics = null
}: ArticleGenerationProgressProps) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  const currentStageIndex = GENERATION_STAGES.findIndex(s => s.key === currentStage);
  
  // V5.0: Show waiting message when stuck on any stage
  const showWaitingMessage = isStuck;
  const stuckMessage = currentStage === 'images' 
    ? 'Gerando imagens em segundo plano...'
    : 'Aguardando resposta do servidor...';
  const stuckSubMessage = currentStage === 'images'
    ? 'A geração de imagens pode levar mais tempo. O artigo será salvo automaticamente.'
    : 'A geração está em progresso. Aguarde mais um momento.';
  
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
          <span>Tempo estimado: 20-30 segundos</span>
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
      
      {/* Waiting for Server Warning (when stuck) */}
      {showWaitingMessage && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 animate-spin" />
          <div className="flex-1">
            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              {stuckMessage}
            </p>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
              {stuckSubMessage}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDiagnostics(true)}
            className="gap-1 text-blue-600 hover:text-blue-700"
          >
            <Activity className="h-4 w-4" />
            Diagnóstico
          </Button>
        </div>
      )}
      
      {/* Timeout Warning */}
      {showTimeoutWarning && !showWaitingMessage && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
          <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-300">
            Geração está demorando mais que o esperado. Aguarde mais um momento...
          </p>
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="flex justify-center gap-3 pt-2">
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="gap-2 text-muted-foreground hover:text-destructive"
          >
            <X className="h-4 w-4" />
            Cancelar
          </Button>
        )}
        
        {diagnostics && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDiagnostics(true)}
            className="gap-2"
          >
            <Activity className="h-4 w-4" />
            Ver Diagnóstico
          </Button>
        )}
      </div>
      
      {/* Diagnostics Dialog */}
      <GenerationDiagnosticsDialog
        diagnostics={diagnostics}
        isOpen={showDiagnostics}
        onOpenChange={setShowDiagnostics}
      />
    </div>
  );
}
