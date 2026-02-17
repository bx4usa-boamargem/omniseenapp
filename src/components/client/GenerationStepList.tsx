import { Brain, FileText, Search, Waves, Image, Rocket, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type GenerationStep = 
  | 'analyzing' 
  | 'generating' 
  | 'seo' 
  | 'rhythm' 
  | 'images' 
  | 'publishing' 
  | 'complete';

interface GenerationStepListProps {
  currentStep: GenerationStep;
  progress: number;
}

const STEPS = [
  { id: 'analyzing' as const, label: 'Analisando intenção e nicho', icon: Brain },
  { id: 'generating' as const, label: 'Gerando conteúdo principal', icon: FileText },
  { id: 'seo' as const, label: 'Otimizando SEO', icon: Search },
  { id: 'rhythm' as const, label: 'Ajustando leitura e ritmo', icon: Waves },
  { id: 'images' as const, label: 'Criando imagens', icon: Image },
  { id: 'publishing' as const, label: 'Publicando artigo', icon: Rocket },
];

const STEP_ORDER: GenerationStep[] = ['analyzing', 'generating', 'seo', 'rhythm', 'images', 'publishing', 'complete'];

export function GenerationStepList({ currentStep, progress }: GenerationStepListProps) {
  const currentIndex = STEP_ORDER.indexOf(currentStep);

  const getStepStatus = (stepId: GenerationStep): 'pending' | 'active' | 'completed' => {
    const stepIndex = STEP_ORDER.indexOf(stepId);
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Criando seu artigo com IA...</h2>
            <p className="text-sm text-muted-foreground">Acompanhe o progresso em tempo real</p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {STEPS.map((step) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;
          
          return (
            <div 
              key={step.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-all duration-300",
                status === 'completed' && "bg-green-500/10",
                status === 'active' && "bg-primary/10 border border-primary/20",
                status === 'pending' && "bg-muted/30 opacity-60"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                status === 'completed' && "bg-green-500 text-white",
                status === 'active' && "bg-primary text-primary-foreground",
                status === 'pending' && "bg-muted text-muted-foreground"
              )}>
                {status === 'completed' ? (
                  <Check className="h-4 w-4" />
                ) : status === 'active' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              
              <span className={cn(
                "flex-1 font-medium transition-colors",
                status === 'completed' && "text-green-600 dark:text-green-400",
                status === 'active' && "text-foreground",
                status === 'pending' && "text-muted-foreground"
              )}>
                {step.label}
              </span>

              {status === 'completed' && (
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                  ✓ Concluído
                </span>
              )}
              {status === 'active' && (
                <span className="text-xs text-primary font-medium animate-pulse">
                  Em andamento...
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progresso</span>
          <span className="font-medium text-foreground">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
