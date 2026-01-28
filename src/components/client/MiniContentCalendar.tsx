import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, Calendar, Radar, Target, PenLine } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { smartNavigate, getClientArticleEditPath } from '@/utils/platformUrls';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Article {
  id: string;
  title: string;
  status: string;
  published_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  generation_source: string | null;
  opportunity_id: string | null;
  funnel_stage: string | null;
}

interface MiniContentCalendarProps {
  blogId: string;
  onDayClick?: (date: Date, items: Article[]) => void;
}

const STATUS_CONFIG = {
  scheduled: { color: 'bg-blue-500/60', label: 'Agendado' },
  published: { color: 'bg-success/60', label: 'Publicado' },
  draft: { color: 'bg-muted-foreground/40', label: 'Rascunho' },
  archived: { color: 'bg-gray-500/40', label: 'Arquivado' },
};

export function MiniContentCalendar({ blogId, onDayClick }: MiniContentCalendarProps) {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedDayArticles, setSelectedDayArticles] = useState<Article[]>([]);

  useEffect(() => {
    if (!blogId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch ALL articles - single source of truth (no more article_queue)
        const { data: articlesData } = await supabase
          .from('articles')
          .select('id, title, status, published_at, scheduled_at, created_at, generation_source, opportunity_id, funnel_stage')
          .eq('blog_id', blogId)
          .order('created_at', { ascending: false });

        if (articlesData) {
          setArticles(articlesData as Article[]);
        }
      } catch (error) {
        console.error('Error fetching calendar data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Subscribe to realtime updates for articles only
    const articlesChannel = supabase
      .channel('mini-calendar-articles')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'articles',
        filter: `blog_id=eq.${blogId}`,
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(articlesChannel);
    };
  }, [blogId]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = monthStart.getDay();
  const emptyDays = Array(startDayOfWeek).fill(null);

  const getItemsForDay = (day: Date): Article[] => {
    return articles.filter(article => {
      // Published articles by published_at
      if (article.status === 'published' && article.published_at) {
        return isSameDay(new Date(article.published_at), day);
      }
      // Scheduled articles by scheduled_at
      if (article.status === 'scheduled' && article.scheduled_at) {
        return isSameDay(new Date(article.scheduled_at), day);
      }
      // Drafts by created_at
      if (article.status === 'draft') {
        return isSameDay(new Date(article.created_at), day);
      }
      return false;
    });
  };

  const getStatusColor = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]?.color || 'bg-muted';
  };

  const getOriginIcon = (article: Article) => {
    if (article.opportunity_id) {
      return <Radar className="h-3 w-3 text-purple-500" />;
    }
    if (article.funnel_stage || article.generation_source === 'sales_funnel') {
      return <Target className="h-3 w-3 text-orange-500" />;
    }
    return <PenLine className="h-3 w-3 text-muted-foreground" />;
  };

  const getOriginLabel = (article: Article) => {
    if (article.opportunity_id) return '📡 Radar';
    if (article.funnel_stage || article.generation_source === 'sales_funnel') return '🎯 Funil';
    return '✏️ Manual';
  };

  const handleDayClick = (day: Date) => {
    const items = getItemsForDay(day);
    if (items.length > 0) {
      setSelectedDay(day);
      setSelectedDayArticles(items);
    }
    if (onDayClick) {
      onDayClick(day, items);
    }
  };

  const handleArticleClick = (articleId: string) => {
    setSelectedDay(null);
    smartNavigate(navigate, getClientArticleEditPath(articleId));
  };

  return (
    <>
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Calendário de Conteúdo
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[100px] text-center capitalize">
                {format(currentMonth, 'MMM yyyy', { locale: ptBR })}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs ml-1"
                onClick={() => setCurrentMonth(new Date())}
              >
                Hoje
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
              <div key={i} className="text-center text-xs font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-0.5">
            {emptyDays.map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {days.map((day) => {
              const items = getItemsForDay(day);
              const hasItems = items.length > 0;
              const dayIsToday = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "aspect-square flex flex-col items-center justify-center rounded-md text-xs transition-colors relative",
                    dayIsToday && "bg-primary/10 font-bold text-primary ring-1 ring-primary/30",
                    !dayIsToday && "hover:bg-muted/50",
                    hasItems && "cursor-pointer"
                  )}
                >
                  <span>{format(day, 'd')}</span>
                  {hasItems && (
                    <div className="flex gap-0.5 mt-0.5">
                      {items.slice(0, 3).map((item, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            getStatusColor(item.status)
                          )}
                        />
                      ))}
                      {items.length > 3 && (
                        <span className="text-[8px] text-muted-foreground">+</span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-3 pt-3 border-t text-[10px]">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
              <span className="text-muted-foreground">Rascunho</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500/60" />
              <span className="text-muted-foreground">Agendado</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-success/60" />
              <span className="text-muted-foreground">Publicado</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day Details Modal - Click to open editor */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              {selectedDay && format(selectedDay, "dd 'de' MMMM", { locale: ptBR })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {selectedDayArticles.map((article) => (
              <div
                key={article.id}
                onClick={() => handleArticleClick(article.id)}
                className="p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{article.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        className={cn(
                          "text-[10px]",
                          article.status === 'published' && "bg-success/20 text-success",
                          article.status === 'scheduled' && "bg-blue-500/20 text-blue-600",
                          article.status === 'draft' && "bg-muted text-muted-foreground"
                        )}
                      >
                        {STATUS_CONFIG[article.status as keyof typeof STATUS_CONFIG]?.label || article.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {getOriginLabel(article)}
                      </span>
                    </div>
                  </div>
                  {getOriginIcon(article)}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Clique em um artigo para abrir o editor
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
