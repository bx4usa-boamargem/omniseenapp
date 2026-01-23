import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface MetaPatterns {
  avgLength: number;
  commonPhrases: string[];
  descriptions: string[];
}

interface KeywordPresence {
  inTitle: number;
  inH1: number;
  inH2: number;
  inMeta: number;
  inFirstParagraph: number;
}

interface MetaTagsTabProps {
  articleMeta?: string;
  keyword: string;
  metaPatterns?: MetaPatterns;
  keywordPresence?: KeywordPresence;
  className?: string;
}

export function MetaTagsTab({
  articleMeta,
  keyword,
  metaPatterns,
  keywordPresence,
  className
}: MetaTagsTabProps) {
  const metaLength = articleMeta?.length || 0;
  const hasKeywordInMeta = articleMeta?.toLowerCase().includes(keyword.toLowerCase());
  const keywordInMetaPercentage = keywordPresence?.inMeta || 0;
  const shouldHaveKeyword = keywordInMetaPercentage >= 50;
  const avgLength = metaPatterns?.avgLength || 150;

  const getLengthStatus = () => {
    if (metaLength === 0) return { status: 'missing', color: 'text-red-500', message: 'Meta description ausente' };
    if (metaLength < 100) return { status: 'short', color: 'text-yellow-500', message: 'Muito curta' };
    if (metaLength > 160) return { status: 'long', color: 'text-yellow-500', message: 'Muito longa (pode ser truncada)' };
    return { status: 'good', color: 'text-green-500', message: 'Tamanho ideal' };
  };

  const lengthStatus = getLengthStatus();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado!",
      description: "Meta description copiada para área de transferência."
    });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Current Article Meta */}
      <div className="border rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Sua Meta Description
          </h4>
          <Badge variant="outline" className={cn("text-[10px]", lengthStatus.color)}>
            {metaLength}/160
          </Badge>
        </div>
        
        {articleMeta ? (
          <p className="text-sm bg-muted/50 p-2 rounded">{articleMeta}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma meta description definida
          </p>
        )}

        <div className="flex flex-wrap gap-2 text-xs">
          <span className={cn("flex items-center gap-1", lengthStatus.color)}>
            {lengthStatus.status === 'good' ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            {lengthStatus.message}
          </span>

          {!hasKeywordInMeta && shouldHaveKeyword && (
            <span className="flex items-center gap-1 text-red-500">
              <AlertTriangle className="h-3 w-3" />
              {keywordInMetaPercentage}% dos concorrentes têm a keyword na meta
            </span>
          )}

          {hasKeywordInMeta && (
            <span className="flex items-center gap-1 text-green-500">
              <CheckCircle2 className="h-3 w-3" />
              Keyword presente
            </span>
          )}
        </div>
      </div>

      {/* Competitor Meta Descriptions */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Metas dos Concorrentes
          </h4>
          <span className="text-[10px] text-muted-foreground">
            Média: {avgLength} caracteres
          </span>
        </div>
        
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {metaPatterns?.descriptions && metaPatterns.descriptions.length > 0 ? (
            metaPatterns.descriptions.slice(0, 5).map((meta, i) => (
              <div 
                key={i}
                className="group relative text-xs p-2.5 bg-muted/30 rounded-md border border-border/50"
              >
                <span className="font-mono text-muted-foreground mr-2">#{i + 1}</span>
                {meta}
                <span className="text-[10px] text-muted-foreground ml-2">
                  ({meta.length})
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleCopy(meta)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            ))
          ) : (
            <div className="text-xs text-muted-foreground text-center py-4 bg-muted/30 rounded-md">
              Analise a SERP para ver as meta descriptions dos concorrentes
            </div>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md p-3 text-xs space-y-1">
        <div className="font-medium text-blue-700 dark:text-blue-300">
          Dicas para Meta Description
        </div>
        <ul className="text-blue-600 dark:text-blue-400 space-y-1 ml-3">
          <li>• Mantenha entre 120-160 caracteres</li>
          <li>• Inclua a palavra-chave principal</li>
          <li>• Adicione um call-to-action</li>
          <li>• Destaque o benefício principal</li>
        </ul>
      </div>
    </div>
  );
}
