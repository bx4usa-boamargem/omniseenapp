import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface LiveArticlePreviewProps {
  title: string;
  content: string;
  isGenerating: boolean;
}

export function LiveArticlePreview({ title, content, isGenerating }: LiveArticlePreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as content grows
  useEffect(() => {
    if (scrollRef.current && isGenerating) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, isGenerating]);

  // Parse content to identify structure
  const renderContent = () => {
    if (!content) {
      return (
        <div className="space-y-4 animate-pulse">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-5/6" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
      );
    }

    const lines = content.split('\n');
    
    return lines.map((line, index) => {
      const trimmedLine = line.trim();
      
      // H1
      if (trimmedLine.startsWith('# ')) {
        return (
          <h1 key={index} className="text-2xl font-bold text-foreground mb-4 mt-6 first:mt-0">
            {trimmedLine.replace('# ', '')}
          </h1>
        );
      }
      
      // H2
      if (trimmedLine.startsWith('## ')) {
        return (
          <h2 key={index} className="text-xl font-semibold text-foreground mb-3 mt-6 border-b border-border pb-2">
            {trimmedLine.replace('## ', '')}
          </h2>
        );
      }
      
      // H3
      if (trimmedLine.startsWith('### ')) {
        return (
          <h3 key={index} className="text-lg font-medium text-foreground mb-2 mt-4">
            {trimmedLine.replace('### ', '')}
          </h3>
        );
      }

      // Blockquote / Highlight
      if (trimmedLine.startsWith('> ')) {
        return (
          <blockquote 
            key={index} 
            className="border-l-4 border-primary pl-4 py-2 my-4 bg-primary/5 rounded-r-lg italic text-foreground/80"
          >
            {trimmedLine.replace('> ', '')}
          </blockquote>
        );
      }

      // List items
      if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
        return (
          <li key={index} className="ml-4 text-foreground/90 mb-1">
            {trimmedLine.replace(/^[-*]\s/, '')}
          </li>
        );
      }

      // Numbered list
      if (/^\d+\.\s/.test(trimmedLine)) {
        return (
          <li key={index} className="ml-4 text-foreground/90 mb-1 list-decimal">
            {trimmedLine.replace(/^\d+\.\s/, '')}
          </li>
        );
      }

      // Bold text handling
      const parseBold = (text: string) => {
        const parts = text.split(/\*\*(.*?)\*\*/g);
        return parts.map((part, i) => 
          i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
        );
      };

      // Empty line
      if (!trimmedLine) {
        return <div key={index} className="h-3" />;
      }

      // Regular paragraph
      return (
        <p key={index} className="text-foreground/90 leading-relaxed mb-3">
          {parseBold(trimmedLine)}
        </p>
      );
    });
  };

  return (
    <div className="h-full flex flex-col bg-background rounded-xl border border-border overflow-hidden">
      {/* Preview Header */}
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
        </div>
        <span className="text-sm text-muted-foreground font-medium">Prévia do Artigo</span>
      </div>

      {/* Content Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 scroll-smooth"
      >
        {/* Title */}
        {title && (
          <div className="mb-6 pb-4 border-b border-border">
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          </div>
        )}

        {/* Article Content */}
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {renderContent()}
        </div>

        {/* Typing Cursor */}
        {isGenerating && content && (
          <span className="inline-block w-0.5 h-5 bg-primary animate-pulse ml-0.5" />
        )}

        {/* Placeholder when no content */}
        {!content && !title && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="text-muted-foreground">O artigo aparecerá aqui...</p>
          </div>
        )}
      </div>
    </div>
  );
}
