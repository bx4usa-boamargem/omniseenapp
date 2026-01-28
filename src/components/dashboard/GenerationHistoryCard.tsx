import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { smartNavigate, getClientArticleEditPath } from '@/utils/platformUrls';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  History,
  ChevronRight,
  Sparkles,
  Radar,
  Zap,
  Target,
  PenSquare
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface GenerationItem {
  id: string;
  title: string;
  status: 'completed' | 'failed' | 'generating';
  createdAt: Date;
  source: string;
  articleId?: string;
  errorMessage?: string;
}

interface GenerationHistoryCardProps {
  blogId: string;
  className?: string;
}

const statusConfig: Record<string, { 
  icon: typeof CheckCircle2; 
  color: string; 
  bg: string; 
  label: string; 
  animate?: boolean;
}> = {
  completed: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    label: 'Concluído'
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    label: 'Falhou'
  },
  generating: {
    icon: Loader2,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    label: 'Gerando...',
    animate: true
  }
};

const sourceConfig: Record<string, { icon: typeof Sparkles; label: string; color: string }> = {
  manual: { icon: PenSquare, label: 'Manual', color: 'text-gray-500' },
  opportunity: { icon: Radar, label: 'Radar', color: 'text-purple-500' },
  automation: { icon: Zap, label: 'Automação', color: 'text-amber-500' },
  funnel: { icon: Target, label: 'Funil', color: 'text-blue-500' },
  ai_suggestion: { icon: Sparkles, label: 'IA', color: 'text-primary' }
};

function GenerationHistoryItem({ 
  item, 
  onClick 
}: { 
  item: GenerationItem; 
  onClick?: () => void;
}) {
  const config = statusConfig[item.status];
  const Icon = config.icon;
  const sourceInfo = sourceConfig[item.source] || sourceConfig.manual;
  const SourceIcon = sourceInfo.icon;

  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border border-border/50 transition-colors",
        item.articleId && "cursor-pointer hover:bg-accent/50"
      )}
      onClick={onClick}
    >
      <div className={cn("p-2 rounded-full shrink-0", config.bg)}>
        <Icon className={cn(
          "h-4 w-4", 
          config.color, 
          config.animate && "animate-spin"
        )} />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-foreground">{item.title}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{formatDistanceToNow(item.createdAt, { addSuffix: true, locale: ptBR })}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <SourceIcon className={cn("h-3 w-3", sourceInfo.color)} />
            {sourceInfo.label}
          </span>
        </div>
        {item.errorMessage && (
          <p className="text-xs text-red-500 mt-1 truncate">{item.errorMessage}</p>
        )}
      </div>

      {item.articleId && (
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      
      {item.status === 'generating' && (
        <Badge variant="outline" className="text-blue-500 border-blue-500/30 shrink-0">
          {config.label}
        </Badge>
      )}
    </div>
  );
}

export function GenerationHistoryCard({ blogId, className }: GenerationHistoryCardProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<GenerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  const fetchGenerationHistory = async () => {
    if (!blogId) return;

    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // 1. Fetch items currently generating (article_queue)
      const { data: generating } = await supabase
        .from('article_queue')
        .select('id, suggested_theme, created_at, generation_source')
        .eq('blog_id', blogId)
        .eq('status', 'generating')
        .order('created_at', { ascending: false });

      // 2. Fetch recent articles (last 24h)
      const { data: recentArticles } = await supabase
        .from('articles')
        .select('id, title, created_at, generation_source, status')
        .eq('blog_id', blogId)
        .gte('created_at', yesterday)
        .order('created_at', { ascending: false })
        .limit(10);

      // 3. Fetch failed generations from article_queue
      const { data: failures } = await supabase
        .from('article_queue')
        .select('id, suggested_theme, created_at, error_message, generation_source')
        .eq('blog_id', blogId)
        .eq('status', 'failed')
        .gte('created_at', yesterday)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!isMounted.current) return;

      // Combine and sort by date
      const combined: GenerationItem[] = [
        ...(generating || []).map(g => ({
          id: g.id,
          title: g.suggested_theme,
          status: 'generating' as const,
          createdAt: new Date(g.created_at),
          source: g.generation_source || 'automation'
        })),
        ...(recentArticles || []).map(a => ({
          id: a.id,
          title: a.title,
          status: 'completed' as const,
          createdAt: new Date(a.created_at),
          source: a.generation_source || 'manual',
          articleId: a.id
        })),
        ...(failures || []).map(f => ({
          id: f.id,
          title: f.suggested_theme || 'Artigo',
          status: 'failed' as const,
          createdAt: new Date(f.created_at),
          source: f.generation_source || 'automation',
          errorMessage: f.error_message
        }))
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      setItems(combined.slice(0, 8));
    } catch (error) {
      console.error('Error fetching generation history:', error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (blogId) {
      fetchGenerationHistory();

      // Subscribe to realtime updates
      const channel = supabase
        .channel(`generation-history-${blogId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'articles',
          filter: `blog_id=eq.${blogId}`
        }, () => {
          setTimeout(fetchGenerationHistory, 500);
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'article_queue',
          filter: `blog_id=eq.${blogId}`
        }, () => {
          setTimeout(fetchGenerationHistory, 500);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [blogId]);

  const handleItemClick = (item: GenerationItem) => {
    if (item.articleId) {
      smartNavigate(navigate, getClientArticleEditPath(item.articleId));
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-5 w-5 text-primary" />
          Histórico de Gerações
        </CardTitle>
        <CardDescription>
          Últimas 24 horas
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma geração recente</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {items.map(item => (
              <GenerationHistoryItem 
                key={item.id} 
                item={item} 
                onClick={() => handleItemClick(item)}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
