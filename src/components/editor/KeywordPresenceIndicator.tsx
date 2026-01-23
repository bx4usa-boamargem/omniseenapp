import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface KeywordPresence {
  inTitle: number;
  inH1: number;
  inH2: number;
  inMeta: number;
  inFirstParagraph: number;
}

interface KeywordPresenceIndicatorProps {
  keywordPresence?: KeywordPresence;
  article: {
    title: string;
    content: string;
    meta_description?: string;
  };
  keyword: string;
  className?: string;
}

function hasKeywordInH1(content: string, keyword: string): boolean {
  const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match) {
    return h1Match[1].toLowerCase().includes(keyword.toLowerCase());
  }
  return false;
}

function hasKeywordInH2(content: string, keyword: string): boolean {
  const h2Matches = content.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi);
  for (const match of h2Matches) {
    if (match[1].toLowerCase().includes(keyword.toLowerCase())) {
      return true;
    }
  }
  return false;
}

function hasKeywordInFirstParagraph(content: string, keyword: string): boolean {
  // Get first paragraph (first <p> tag or first significant text block)
  const pMatch = content.match(/<p[^>]*>([^<]+)<\/p>/i);
  if (pMatch) {
    return pMatch[1].toLowerCase().includes(keyword.toLowerCase());
  }
  // Fallback: check first 500 chars
  const firstPart = content.substring(0, 500).replace(/<[^>]*>/g, '');
  return firstPart.toLowerCase().includes(keyword.toLowerCase());
}

interface IndicatorProps {
  label: string;
  marketPercentage: number;
  isPresent: boolean;
}

function PresenceIndicator({ label, marketPercentage, isPresent }: IndicatorProps) {
  const shouldHave = marketPercentage >= 50;
  const isCorrect = shouldHave ? isPresent : true;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          "text-center p-2 rounded-md border transition-colors",
          isPresent 
            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" 
            : shouldHave 
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              : "bg-muted/50 border-border"
        )}>
          <div className="text-[10px] font-medium text-muted-foreground mb-1">
            {label}
          </div>
          <div className="flex items-center justify-center">
            {isPresent ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-500" />
            )}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            {marketPercentage}% mercado
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">
          {isPresent 
            ? `✓ Keyword presente no ${label}` 
            : `✗ Keyword ausente no ${label}`
          }
          <br />
          <span className="text-muted-foreground">
            {marketPercentage}% dos concorrentes têm no {label}
          </span>
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function KeywordPresenceIndicator({
  keywordPresence,
  article,
  keyword,
  className
}: KeywordPresenceIndicatorProps) {
  if (!keyword || !keywordPresence) {
    return null;
  }

  const indicators = [
    { 
      label: 'Título', 
      market: keywordPresence.inTitle, 
      has: article.title.toLowerCase().includes(keyword.toLowerCase()) 
    },
    { 
      label: 'H1', 
      market: keywordPresence.inH1, 
      has: hasKeywordInH1(article.content, keyword) 
    },
    { 
      label: 'H2', 
      market: keywordPresence.inH2, 
      has: hasKeywordInH2(article.content, keyword) 
    },
    { 
      label: 'Meta', 
      market: keywordPresence.inMeta, 
      has: article.meta_description?.toLowerCase().includes(keyword.toLowerCase()) ?? false 
    },
    { 
      label: '1º Par.', 
      market: keywordPresence.inFirstParagraph, 
      has: hasKeywordInFirstParagraph(article.content, keyword) 
    },
  ];

  return (
    <div className={cn("space-y-2", className)}>
      <div className="text-xs font-semibold text-muted-foreground uppercase">
        Presença da Keyword
      </div>
      <div className="grid grid-cols-5 gap-1">
        {indicators.map(ind => (
          <PresenceIndicator
            key={ind.label}
            label={ind.label}
            marketPercentage={ind.market}
            isPresent={ind.has}
          />
        ))}
      </div>
    </div>
  );
}
