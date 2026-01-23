import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Info, BookOpen, FileText, Tag } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TermsTabsPanelProps {
  // Primary source: serpMatrix data
  commonTerms: string[];
  topTitles: string[];
  
  // Secondary source: score breakdown (for coloring)
  coveredTerms: string[];
  missingTerms: string[];
  coveragePercentage: number;
  
  // State
  loading?: boolean;
  hasAnalysis: boolean;
  className?: string;
}

interface TermBadgeProps {
  term: string;
  status: 'present' | 'partial' | 'missing';
  count?: number;
  target?: number;
}

function TermBadge({ term, status, count, target }: TermBadgeProps) {
  const getStatusStyles = () => {
    switch (status) {
      case 'present':
        return 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'partial':
        return 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800';
      case 'missing':
        return 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
    }
  };

  return (
    <div className={cn(
      "inline-flex flex-col items-start px-2.5 py-1.5 rounded-md text-xs border gap-0.5",
      getStatusStyles()
    )}>
      <span className="font-medium truncate max-w-[140px]">{term}</span>
      {count !== undefined && target !== undefined && (
        <span className="font-mono text-[10px] opacity-70">{count} / {target}</span>
      )}
    </div>
  );
}

export function TermsTabsPanel({
  commonTerms,
  topTitles,
  coveredTerms,
  missingTerms,
  coveragePercentage,
  loading,
  hasAnalysis,
  className
}: TermsTabsPanelProps) {
  const [activeTab, setActiveTab] = useState('keywords');
  
  // Use serpMatrix as PRIMARY source for counts (fixes the "0" bug)
  const keywordsCount = commonTerms.length;
  const titlesCount = topTitles.length;
  const metaTagsCount = 0; // Placeholder for future
  
  // Determine term status based on coverage
  const getTermStatus = (term: string): 'present' | 'partial' | 'missing' => {
    const termLower = term.toLowerCase();
    if (coveredTerms.some(t => t.toLowerCase() === termLower)) return 'present';
    if (missingTerms.some(t => t.toLowerCase() === termLower)) return 'missing';
    // If not in either list yet, check if partially matches
    return 'partial';
  };

  // If no analysis, show placeholder
  if (!hasAnalysis && !loading) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
          <span>Termos</span>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-3.5 w-3.5" />
            </TooltipTrigger>
            <TooltipContent>
              Analise a concorrência para ver os termos relevantes
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="text-xs text-muted-foreground text-center py-4 bg-muted/30 rounded-md">
          Analise os concorrentes para ver termos
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted/50 animate-pulse rounded-md" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <span>Termos</span>
        <Tooltip>
          <TooltipTrigger>
            <Info className="h-3.5 w-3.5" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Termos semânticos extraídos dos Top 10 resultados do Google
          </TooltipContent>
        </Tooltip>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 h-8">
          <TabsTrigger value="keywords" className="text-xs gap-1 px-1">
            <BookOpen className="h-3 w-3 hidden sm:inline" />
            <span>Palavras-chave</span>
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {keywordsCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="titles" className="text-xs gap-1 px-1">
            <FileText className="h-3 w-3 hidden sm:inline" />
            <span>Títulos</span>
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {titlesCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="meta" className="text-xs gap-1 px-1">
            <Tag className="h-3 w-3 hidden sm:inline" />
            <span>Meta</span>
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {metaTagsCount}
            </Badge>
          </TabsTrigger>
        </TabsList>

        {/* Keywords Tab */}
        <TabsContent value="keywords" className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto">
            {commonTerms.length > 0 ? (
              commonTerms.slice(0, 20).map((term) => (
                <TermBadge
                  key={term}
                  term={term}
                  status={getTermStatus(term)}
                  count={coveredTerms.includes(term) ? 1 : 0}
                  target={1}
                />
              ))
            ) : (
              <div className="text-xs text-muted-foreground text-center w-full py-4">
                Nenhum termo encontrado
              </div>
            )}
          </div>
          
          {/* Coverage bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Cobertura semântica</span>
              <span className="font-medium">{coveragePercentage}%</span>
            </div>
            <Progress value={coveragePercentage} className="h-2" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span className="text-green-600">{coveredTerms.length} cobertos</span>
              <span className="text-red-600">{missingTerms.length} faltantes</span>
            </div>
          </div>
        </TabsContent>

        {/* Titles Tab */}
        <TabsContent value="titles" className="mt-3">
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {topTitles.length > 0 ? (
              topTitles.slice(0, 10).map((title, i) => (
                <div 
                  key={i} 
                  className="text-xs p-2.5 bg-muted/50 rounded-md border border-border/50"
                >
                  <span className="text-muted-foreground mr-2 font-mono">#{i + 1}</span>
                  {title}
                </div>
              ))
            ) : (
              <div className="text-xs text-muted-foreground text-center py-4">
                Nenhum título encontrado
              </div>
            )}
          </div>
        </TabsContent>

        {/* Meta Tags Tab (Placeholder) */}
        <TabsContent value="meta" className="mt-3">
          <div className="text-center text-xs text-muted-foreground py-6 bg-muted/30 rounded-md">
            <Tag className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p>Análise de meta tags</p>
            <p className="text-[10px] mt-1">Em breve</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
