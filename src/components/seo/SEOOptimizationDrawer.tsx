import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Sparkles, X, CheckCircle2, ArrowRight, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  OptimizationType, 
  ArticleSEO, 
  SEO_OPTIMIZATION_TYPES 
} from '@/config/seoOptimizationTypes';
import { useSEOOptimization, ApplyResult } from '@/hooks/useSEOOptimization';
import { AIProgressIndicator } from './AIProgressIndicator';
import { SEOComparisonCard } from './SEOComparisonCard';

interface SEOOptimizationDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: OptimizationType | null;
  articles: ArticleSEO[];
  blogId: string;
  userId: string;
  onComplete: () => void;
}

export function SEOOptimizationDrawer({
  open,
  onOpenChange,
  type,
  articles,
  blogId,
  userId,
  onComplete
}: SEOOptimizationDrawerProps) {
  const {
    phase,
    suggestions,
    progress,
    error,
    analyze,
    apply,
    toggleSuggestion,
    selectAll,
    reset
  } = useSEOOptimization();

  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const config = type ? SEO_OPTIMIZATION_TYPES[type] : null;
  const selectedCount = suggestions.filter(s => s.selected).length;

  // Start analysis when drawer opens
  useEffect(() => {
    if (open && type && phase === 'idle') {
      analyze(type, articles, blogId, userId);
    }
  }, [open, type, phase, analyze, articles, blogId, userId]);

  // Handle close
  const handleClose = () => {
    if (phase === 'complete') {
      onComplete();
    }
    reset();
    onOpenChange(false);
  };

  // Handle apply
  const handleApply = async () => {
    if (type) {
      const result = await apply(type, userId);
      setApplyResult(result);
    }
  };

  if (!type || !config) return null;

  const Icon = config.icon;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent 
        side="right" 
        className={cn(
          "w-full sm:w-[540px] sm:max-w-[540px] p-0 border-l",
          "border-purple-500/20 bg-white dark:bg-gray-900",
          "animate-slide-in-right"
        )}
      >
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b border-gray-100 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Icon className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <SheetTitle className="text-gray-900 dark:text-white">
                  Otimizar {config.label} com IA
                </SheetTitle>
                <SheetDescription className="text-gray-500 dark:text-gray-400 text-sm">
                  {config.description}
                </SheetDescription>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Improvements List */}
          <div className="flex flex-wrap gap-2 mt-4">
            {config.improvements.map((improvement, i) => (
              <span 
                key={i}
                className="text-xs px-2 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400"
              >
                {improvement}
              </span>
            ))}
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex flex-col h-[calc(100vh-200px)]">
          {/* Processing States */}
          {(phase === 'analyzing' || phase === 'generating' || phase === 'applying') && (
            <div className="flex-1 flex items-center justify-center p-8">
              <AIProgressIndicator phase={phase} progress={progress} />
            </div>
          )}

          {/* Complete State with Impact Summary */}
          {phase === 'complete' && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 animate-fade-in">
              <div className="p-4 rounded-full bg-green-500/20 mb-4 animate-check-bounce">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Otimização Concluída!
              </h3>
              
              {/* Impact Summary Card */}
              {applyResult && (
                <div className="w-full max-w-sm bg-muted/50 rounded-xl p-4 mt-4 space-y-3">
                  <h4 className="font-medium text-text-main">Resumo de Impacto</h4>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Artigos alterados:</span>
                    <span className="font-medium text-text-main">{applyResult.applied}</span>
                  </div>
                  
                  {applyResult.failed > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Falhas:</span>
                      <span className="font-medium text-destructive">{applyResult.failed}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Score geral:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{applyResult.scoreBeforeTotal}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-green-500 font-bold">{applyResult.scoreAfterTotal}</span>
                      {applyResult.scoreAfterTotal > applyResult.scoreBeforeTotal && (
                        <Badge className="bg-green-500/20 text-green-600 text-xs border-0">
                          +{applyResult.scoreAfterTotal - applyResult.scoreBeforeTotal}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Expandable changes list */}
                  {applyResult.changes.length > 0 && (
                    <details className="mt-4">
                      <summary className="text-primary cursor-pointer text-sm hover:underline">
                        Ver mudanças detalhadas ({applyResult.changes.length})
                      </summary>
                      <ul className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                        {applyResult.changes.map((change, idx) => (
                          <li key={idx} className="text-xs border-l-2 border-primary pl-2">
                            <strong className="text-text-main">{change.articleTitle.substring(0, 30)}...</strong>
                            <div className="text-muted-foreground line-through">{change.before.substring(0, 40)}...</div>
                            <div className="text-green-600">{change.after.substring(0, 40)}...</div>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
              
              {!applyResult && (
                <p className="text-gray-500 dark:text-gray-400 text-center mb-6">
                  {progress.current} {progress.current === 1 ? 'artigo foi otimizado' : 'artigos foram otimizados'} com sucesso.
                </p>
              )}
              
              <Button onClick={handleClose} className="mt-6 gap-2">
                <ArrowRight className="h-4 w-4" />
                Ver Resultados
              </Button>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <p className="text-red-500 mb-4">{error}</p>
                <Button variant="outline" onClick={() => type && analyze(type, articles, blogId, userId)}>
                  Tentar novamente
                </Button>
              </div>
            </div>
          )}

          {/* Suggestions List */}
          {phase === 'ready' && suggestions.length > 0 && (
            <>
              <div className="px-6 py-3 bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedCount} de {suggestions.length} selecionados
                  </span>
                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => selectAll(false)}
                      className="text-xs"
                    >
                      Desmarcar todos
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => selectAll(true)}
                      className="text-xs"
                    >
                      Selecionar todos
                    </Button>
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 px-6 py-4 pb-32">
                <div className="space-y-4 pb-8">
                  {suggestions.map((suggestion, index) => (
                    <SEOComparisonCard
                      key={suggestion.articleId}
                      articleTitle={suggestion.articleTitle}
                      originalValue={suggestion.originalValue}
                      suggestedValue={suggestion.suggestedValue}
                      improvement={suggestion.improvement}
                      predictedImpact={suggestion.predictedImpact}
                      type={type}
                      selected={suggestion.selected}
                      onToggle={() => toggleSuggestion(suggestion.articleId)}
                      className="animate-stagger-fade-in opacity-0"
                      style={{ 
                        animationDelay: `${index * 100}ms`,
                        animationFillMode: 'forwards'
                      }}
                    />
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        {/* Sticky Footer - Always visible */}
        {phase === 'ready' && suggestions.length > 0 && (
          <div className="sticky bottom-0 z-50 p-6 border-t border-gray-100 dark:border-white/10 
                          bg-white dark:bg-gray-900 
                          pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]
                          shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={handleClose}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleApply}
                disabled={selectedCount === 0}
                className="flex-1 gap-2 bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600"
              >
                <Sparkles className="h-4 w-4" />
                Aplicar {selectedCount} {selectedCount === 1 ? 'Mudança' : 'Mudanças'}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
