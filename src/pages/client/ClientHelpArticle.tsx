import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ChevronLeft, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeHTML } from '@/lib/sanitize';

interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  content: string;
  icon: string | null;
  header_gif_url: string | null;
}

const categoryInfo: Record<string, { label: string; color: string; bgColor: string }> = {
  'primeiros-passos': { label: 'Primeiros Passos', color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  'resultados': { label: 'Resultados & ROI', color: 'text-emerald-600', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
  'inteligencia': { label: 'Inteligência', color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  'conteudo': { label: 'Conteúdo', color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  'operacao': { label: 'Operação', color: 'text-slate-600', bgColor: 'bg-slate-100 dark:bg-slate-900/30' },
  'integracoes': { label: 'Integrações', color: 'text-cyan-600', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30' },
};

const calculateReadingTime = (content: string): number => {
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
};

// Format content with headers, lists, special blocks, and GIFs
const formatContent = (content: string) => {
  if (!content) return [];

  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType === 'ol' ? 'ol' : 'ul';
      elements.push(
        <ListTag key={key++} className={cn(
          "my-4 pl-6 space-y-2",
          listType === 'ol' ? "list-decimal" : "list-disc"
        )}>
          {listItems.map((item, i) => (
            <li key={i} className="text-muted-foreground" 
                dangerouslySetInnerHTML={{ __html: sanitizeHTML(item.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground">$1</strong>')) }} 
            />
          ))}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  const parseBold = (text: string) => {
    const raw = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>');
    return sanitizeHTML(raw);
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    // GIF inline syntax: ![gif:filename.gif]
    if (trimmed.match(/^!\[gif:(.*?)\]$/)) {
      flushList();
      const gifMatch = trimmed.match(/^!\[gif:(.*?)\]$/);
      if (gifMatch) {
        const gifUrl = gifMatch[1];
        // Support both relative paths and full URLs
        const fullUrl = gifUrl.startsWith('http') ? gifUrl : `/gifs/${gifUrl}`;
        elements.push(
          <div key={key++} className="my-6 rounded-xl overflow-hidden border shadow-sm bg-muted/30">
            <img 
              src={fullUrl}
              alt="Tutorial animado"
              className="w-full h-auto"
              loading="lazy"
            />
            <div className="bg-muted/50 px-4 py-2 text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
              <span>📹</span>
              <span>Demonstração visual da funcionalidade</span>
            </div>
          </div>
        );
      }
      return;
    }

    // H2 Headers
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={key++} className="text-xl font-bold mt-8 mb-4 text-foreground">
          {trimmed.slice(3)}
        </h2>
      );
      return;
    }

    // H3 Headers
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={key++} className="text-lg font-semibold mt-6 mb-3 text-foreground">
          {trimmed.slice(4)}
        </h3>
      );
      return;
    }

    // Bullet lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(trimmed.slice(2));
      return;
    }

    // Numbered lists
    if (/^\d+\.\s/.test(trimmed)) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(trimmed.replace(/^\d+\.\s/, ''));
      return;
    }

    // Special blocks (tips, warnings, notes)
    if (trimmed.startsWith('💡') || trimmed.startsWith('⚠️') || trimmed.startsWith('📌')) {
      flushList();
      const isWarning = trimmed.startsWith('⚠️');
      const isNote = trimmed.startsWith('📌');
      elements.push(
        <div key={key++} className={cn(
          "my-4 p-4 rounded-lg border-l-4",
          isWarning ? "bg-amber-50 dark:bg-amber-900/20 border-amber-500" :
          isNote ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500" :
          "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500"
        )}>
          <p className="text-sm" dangerouslySetInnerHTML={{ __html: parseBold(trimmed) }} />
        </div>
      );
      return;
    }

    // Table rows (simple markdown tables)
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      // Skip separator rows
      if (trimmed.includes('---')) return;
      
      const cells = trimmed.split('|').filter(c => c.trim()).map(c => c.trim());
      const isHeader = elements.length === 0 || !elements[elements.length - 1]?.props?.className?.includes('table');
      
      elements.push(
        <div key={key++} className={cn(
          "grid gap-2 py-2 px-3 text-sm border-b",
          isHeader ? "font-semibold bg-muted/50" : ""
        )} style={{ gridTemplateColumns: `repeat(${cells.length}, 1fr)` }}>
          {cells.map((cell, i) => (
            <span key={i} dangerouslySetInnerHTML={{ __html: parseBold(cell) }} />
          ))}
        </div>
      );
      return;
    }

    // Empty lines
    if (!trimmed) {
      flushList();
      return;
    }

    // Regular paragraphs
    flushList();
    elements.push(
      <p key={key++} className="text-muted-foreground my-3 leading-relaxed"
         dangerouslySetInnerHTML={{ __html: parseBold(trimmed) }}
      />
    );
  });

  flushList();
  return elements;
};

export default function ClientHelpArticle() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [article, setArticle] = useState<HelpArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    if (slug) {
      fetchArticle();
    }
  }, [user, slug]);

  const fetchArticle = async () => {
    try {
      const { data, error } = await supabase
        .from('help_articles')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single();

      if (error) throw error;
      setArticle(data);
    } catch (error) {
      console.error('Error fetching article:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/client/help')}
          className="gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar para Ajuda
        </Button>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Artigo não encontrado</h2>
          <p className="text-muted-foreground">
            O artigo que você está procurando não existe ou foi removido.
          </p>
        </div>
      </div>
    );
  }

  const info = categoryInfo[article.category];
  const readingTime = calculateReadingTime(article.content || '');

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate(`/client/help/category/${article.category}`)}
        className="gap-2"
      >
        <ChevronLeft className="h-4 w-4" />
        Voltar para {info?.label || 'Ajuda'}
      </Button>

      {/* Header Image/GIF */}
      {article.header_gif_url && (
        <div className="rounded-xl overflow-hidden border shadow-sm">
          <img
            src={article.header_gif_url}
            alt={article.title}
            className="w-full h-auto"
          />
        </div>
      )}

      {/* Article Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          {info && (
            <Badge className={cn(info.bgColor, info.color, "border-0")}>
              {info.label}
            </Badge>
          )}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{readingTime} min de leitura</span>
          </div>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold">{article.title}</h1>
      </div>

      {/* Article Content */}
      <article className="prose prose-sm dark:prose-invert max-w-none">
        {formatContent(article.content || '')}
      </article>

      {/* Footer */}
      <div className="pt-8 border-t">
        <p className="text-sm text-muted-foreground text-center">
          Ainda tem dúvidas? Use o chat de suporte no canto da tela.
        </p>
      </div>
    </div>
  );
}
