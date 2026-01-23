import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Loader2, 
  CheckCircle2, 
  Circle, 
  XCircle,
  Rocket,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OptimizationStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'skipped' | 'error';
  scoreAfter?: number;
}

interface OptimizeTo100DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steps: OptimizationStep[];
  currentScore: number;
  targetScore?: number;
  progress: number;
  isRunning: boolean;
  onCancel?: () => void;
  scoreHistory: number[];
}

export function OptimizeTo100Dialog({
  open,
  onOpenChange,
  steps,
  currentScore,
  targetScore = 100,
  progress,
  isRunning,
  onCancel,
  scoreHistory
}: OptimizeTo100DialogProps) {
  const getStepIcon = (status: OptimizationStep['status']) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'skipped':
        return <Circle className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground/50" />;
    }
  };

  const completedSteps = steps.filter(s => s.status === 'done').length;
  const totalSteps = steps.length;
  
  // Get the latest score from history or current
  const latestScore = scoreHistory.length > 0 
    ? scoreHistory[scoreHistory.length - 1] 
    : currentScore;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-purple-500" />
            Levando artigo a {targetScore}
          </DialogTitle>
          <DialogDescription>
            Otimizando automaticamente todas as áreas do conteúdo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          {/* Score evolution */}
          <div className="flex items-center justify-center gap-2 py-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Score:</span>
            <div className="flex items-center gap-1">
              {scoreHistory.map((score, i) => (
                <span key={i} className="flex items-center">
                  <span className={cn(
                    "font-mono font-bold",
                    i === scoreHistory.length - 1 
                      ? score >= 80 ? "text-green-600 text-lg" : score >= 60 ? "text-yellow-600 text-lg" : "text-red-600 text-lg"
                      : "text-muted-foreground text-sm"
                  )}>
                    {score}
                  </span>
                  {i < scoreHistory.length - 1 && (
                    <span className="mx-1 text-muted-foreground">→</span>
                  )}
                </span>
              ))}
              {scoreHistory.length === 0 && (
                <span className="font-mono font-bold text-lg">{currentScore}</span>
              )}
            </div>
          </div>

          {/* Steps list */}
          <div className="space-y-2 max-h-[250px] overflow-y-auto">
            {steps.map((step) => (
              <div 
                key={step.id}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-md transition-colors",
                  step.status === 'running' && "bg-primary/10",
                  step.status === 'done' && "bg-green-50 dark:bg-green-900/20",
                  step.status === 'error' && "bg-red-50 dark:bg-red-900/20"
                )}
              >
                {getStepIcon(step.status)}
                <span className={cn(
                  "text-sm flex-1",
                  step.status === 'pending' && "text-muted-foreground",
                  step.status === 'running' && "font-medium",
                  step.status === 'done' && "text-green-700 dark:text-green-300"
                )}>
                  {step.label}
                </span>
                {step.scoreAfter !== undefined && (
                  <span className="text-xs font-mono text-green-600">
                    +{step.scoreAfter}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            {isRunning ? (
              <Button 
                variant="outline" 
                onClick={onCancel}
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Cancelar
              </Button>
            ) : (
              <Button 
                onClick={() => onOpenChange(false)}
                className="gap-2"
              >
                {latestScore >= targetScore ? (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Meta atingida!
                  </>
                ) : (
                  'Fechar'
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
