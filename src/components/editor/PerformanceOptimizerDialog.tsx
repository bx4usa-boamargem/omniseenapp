import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Target,
  Loader2,
  Sparkles,
  CheckCircle,
  ArrowRight,
  Zap,
  Brain
} from 'lucide-react';
import { PerformanceKPICards } from './PerformanceKPICards';
import { DiagnosticList } from './DiagnosticList';
import { 
  usePerformanceOptimizer, 
  type OptimizationResult,
  type TitleSuggestion 
} from '@/hooks/usePerformanceOptimizer';
import { cn } from '@/lib/utils';

interface PerformanceOptimizerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  content: string;
  metaDescription?: string;
  companyName?: string;
  onApplyTitle?: (newTitle: string) => void;
  onApplyContent?: (newContent: string) => void;
  onApplyAll?: (title: string, content: string) => void;
}

export function PerformanceOptimizerDialog({
  open,
  onOpenChange,
  title,
  content,
  metaDescription,
  companyName,
  onApplyTitle,
  onApplyContent,
  onApplyAll
}: PerformanceOptimizerDialogProps) {
  const [mode, setMode] = useState<'assisted' | 'autonomous'>('assisted');
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const { optimize, reset, isOptimizing, result } = usePerformanceOptimizer();

  const handleOptimize = async () => {
    await optimize(title, content, mode, { metaDescription, companyName });
  };

  const handleClose = () => {
    reset();
    setSelectedTitle(null);
    onOpenChange(false);
  };

  const handleApplySelected = () => {
    if (!result) return;

    if (result.mode === 'autonomous') {
      onApplyAll?.(result.optimized_title, result.optimized_content);
    } else if (selectedTitle) {
      onApplyTitle?.(selectedTitle);
    }
    handleClose();
  };

  const handleApplyAll = () => {
    if (!result || result.mode !== 'autonomous') return;
    onApplyAll?.(result.optimized_title, result.optimized_content);
    handleClose();
  };

  const getHealthBadge = (health: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      poor: { variant: 'destructive', label: 'Fraco' },
      moderate: { variant: 'secondary', label: 'Moderado' },
      good: { variant: 'default', label: 'Bom' },
      excellent: { variant: 'outline', label: 'Excelente' }
    };
    const config = variants[health] || variants.moderate;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Motor de Performance
          </DialogTitle>
          <DialogDescription>
            Analise e otimize seu artigo para melhor engajamento e conversão
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {!result ? (
            // Mode Selection & Start
            <div className="space-y-6 py-4">
              <div className="space-y-3">
                <Label className="text-sm font-medium">Escolha o modo de otimização</Label>
                <RadioGroup
                  value={mode}
                  onValueChange={(v) => setMode(v as 'assisted' | 'autonomous')}
                  className="grid grid-cols-2 gap-3"
                >
                  <Label
                    htmlFor="assisted"
                    className={cn(
                      "flex flex-col gap-2 rounded-lg border-2 p-4 cursor-pointer transition-all",
                      mode === 'assisted' 
                        ? "border-primary bg-primary/5" 
                        : "border-muted hover:border-muted-foreground/50"
                    )}
                  >
                    <RadioGroupItem value="assisted" id="assisted" className="sr-only" />
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-yellow-500" />
                      <span className="font-semibold">Assistido</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Receba diagnóstico e sugestões. Você decide o que aplicar.
                    </p>
                  </Label>

                  <Label
                    htmlFor="autonomous"
                    className={cn(
                      "flex flex-col gap-2 rounded-lg border-2 p-4 cursor-pointer transition-all",
                      mode === 'autonomous' 
                        ? "border-primary bg-primary/5" 
                        : "border-muted hover:border-muted-foreground/50"
                    )}
                  >
                    <RadioGroupItem value="autonomous" id="autonomous" className="sr-only" />
                    <div className="flex items-center gap-2">
                      <Brain className="h-5 w-5 text-purple-500" />
                      <span className="font-semibold">Autônomo</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Reescrita automática completa. Revise e aplique o resultado.
                    </p>
                  </Label>
                </RadioGroup>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium mb-2">Artigo a ser otimizado:</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {content.split(/\s+/).filter(Boolean).length} palavras
                </p>
              </div>

              <Button 
                onClick={handleOptimize} 
                disabled={isOptimizing}
                className="w-full"
                size="lg"
              >
                {isOptimizing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Iniciar Otimização
                  </>
                )}
              </Button>
            </div>
          ) : (
            // Results
            <div className="space-y-4 py-4">
              {/* Health Score & KPIs */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{result.diagnosis.score}</span>
                  <span className="text-muted-foreground">/100</span>
                  {getHealthBadge(result.diagnosis.overall_health)}
                </div>
                <Badge variant="outline" className="gap-1">
                  {result.mode === 'assisted' ? (
                    <><Zap className="h-3 w-3" /> Assistido</>
                  ) : (
                    <><Brain className="h-3 w-3" /> Autônomo</>
                  )}
                </Badge>
              </div>

              <PerformanceKPICards
                estimatedReadTimeSeconds={result.diagnosis.estimated_read_time_seconds}
                predictedScrollDepth={result.diagnosis.predicted_scroll_depth}
                predictedBounceRate={result.diagnosis.predicted_bounce_rate}
                improvements={result.mode === 'autonomous' ? result.kpi_improvements : undefined}
              />

              <Separator />

              {result.mode === 'assisted' ? (
                // Assisted Mode Results
                <Tabs defaultValue="diagnosis" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="diagnosis">Diagnóstico</TabsTrigger>
                    <TabsTrigger value="suggestions">Sugestões</TabsTrigger>
                  </TabsList>

                  <TabsContent value="diagnosis" className="mt-4">
                    <DiagnosticList issues={result.diagnosis.issues} />
                  </TabsContent>

                  <TabsContent value="suggestions" className="mt-4 space-y-4">
                    {result.suggestions.title_alternatives.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                          Sugestões de Título
                        </p>
                        <RadioGroup
                          value={selectedTitle || ''}
                          onValueChange={setSelectedTitle}
                          className="space-y-2"
                        >
                          {result.suggestions.title_alternatives.map((suggestion, i) => (
                            <Label
                              key={i}
                              htmlFor={`title-${i}`}
                              className={cn(
                                "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                                selectedTitle === suggestion.title
                                  ? "border-primary bg-primary/5"
                                  : "border-muted hover:border-muted-foreground/50"
                              )}
                            >
                              <RadioGroupItem value={suggestion.title} id={`title-${i}`} className="mt-0.5" />
                              <div className="flex-1">
                                <p className="text-sm font-medium">{suggestion.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    +{suggestion.predicted_ctr_boost}% CTR
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {suggestion.improvement}
                                  </span>
                                </div>
                              </div>
                            </Label>
                          ))}
                        </RadioGroup>
                      </div>
                    )}

                    {result.suggestions.highlight_blocks_to_add.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                          Blocos de Destaque Sugeridos
                        </p>
                        <div className="space-y-2">
                          {result.suggestions.highlight_blocks_to_add.map((block, i) => (
                            <div key={i} className="bg-muted/50 rounded-lg p-3 border-l-4 border-primary">
                              <p className="text-sm italic">{block.replace(/^>\s*\*?|\*$/g, '')}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.suggestions.cta_optimized && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                          CTA Otimizado
                        </p>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                          <p className="text-sm">{result.suggestions.cta_optimized}</p>
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                // Autonomous Mode Results
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Mudanças Realizadas
                    </p>
                    <div className="space-y-1">
                      {result.changes_summary.map((change, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          <span>{change}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                      Novo Título
                    </p>
                    <div className="bg-primary/5 rounded-lg p-3 border border-primary/20">
                      <p className="text-sm font-medium">{result.optimized_title}</p>
                    </div>
                  </div>

                  <DiagnosticList issues={result.diagnosis.issues} />
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {result && (
          <>
            <Separator />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              {result.mode === 'assisted' && selectedTitle && (
                <Button onClick={handleApplySelected}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Aplicar Título
                </Button>
              )}
              {result.mode === 'autonomous' && (
                <Button onClick={handleApplyAll}>
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Aplicar Tudo
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
