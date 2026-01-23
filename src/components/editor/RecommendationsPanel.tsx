import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Wrench, 
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Recommendation {
  text: string;
  type?: 'cta' | 'images' | 'terms' | 'structure' | 'meta' | 'general';
  fixable?: boolean;
}

interface RecommendationsPanelProps {
  recommendations: string[] | Recommendation[];
  onFix?: (recommendation: string | Recommendation, index: number) => Promise<void>;
  className?: string;
}

export function RecommendationsPanel({ 
  recommendations, 
  onFix,
  className 
}: RecommendationsPanelProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [fixingIndex, setFixingIndex] = useState<number | null>(null);
  const [fixedIndices, setFixedIndices] = useState<Set<number>>(new Set());

  // Normalize recommendations to objects
  const normalizedRecs: Recommendation[] = recommendations.map(rec => 
    typeof rec === 'string' ? { text: rec, type: 'general', fixable: true } : rec
  );

  const handleFix = async (rec: Recommendation, index: number) => {
    if (!onFix) return;
    
    setFixingIndex(index);
    try {
      await onFix(rec, index);
      setFixedIndices(prev => new Set([...prev, index]));
    } catch (error) {
      console.error('Error fixing recommendation:', error);
    } finally {
      setFixingIndex(null);
    }
  };

  if (normalizedRecs.length === 0) {
    return null;
  }

  const activeRecs = normalizedRecs.filter((_, i) => !fixedIndices.has(i));

  return (
    <div className={cn("space-y-2", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-1 text-xs font-semibold uppercase text-muted-foreground hover:text-foreground">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
            <span>Recomendações ({activeRecs.length})</span>
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2 space-y-2">
          {normalizedRecs.map((rec, i) => {
            const isFixed = fixedIndices.has(i);
            const isFixing = fixingIndex === i;

            return (
              <div 
                key={i}
                className={cn(
                  "text-xs p-3 rounded-md border transition-all",
                  isFixed 
                    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                    : "bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800"
                )}
              >
                <div className="flex items-start gap-2">
                  {isFixed ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
                  )}
                  <div className="flex-1">
                    <p className={cn(isFixed && "line-through opacity-70")}>
                      {rec.text}
                    </p>
                    
                    {!isFixed && rec.fixable !== false && onFix && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 h-7 text-xs gap-1 bg-white dark:bg-gray-800"
                        onClick={() => handleFix(rec, i)}
                        disabled={isFixing}
                      >
                        {isFixing ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Corrigindo...
                          </>
                        ) : (
                          <>
                            <Wrench className="h-3 w-3" />
                            Corrigir automaticamente
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
