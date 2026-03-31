import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface CalendarArticle {
  id: string;
  title: string;
  status: string | null;
  scheduled_at: string | null;
  published_at: string | null;
}

interface ContentCalendarProps {
  blogId: string;
}

const STATUS_COLORS: Record<string, string> = {
  published: 'bg-green-500/20 text-green-700 dark:text-green-400',
  draft: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  scheduled: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
  generating: 'bg-violet-500/20 text-violet-700 dark:text-violet-400',
};

export function ContentCalendar({ blogId }: ContentCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [articles, setArticles] = useState<CalendarArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticles();
  }, [blogId, currentMonth]);

  const fetchArticles = async () => {
    setLoading(true);
    const start = startOfMonth(currentMonth).toISOString();
    const end = endOfMonth(currentMonth).toISOString();

    const { data, error } = await supabase
      .from('articles')
      .select('id, title, status, scheduled_at, published_at')
      .eq('blog_id', blogId)
      .or(`scheduled_at.gte.${start},published_at.gte.${start}`)
      .or(`scheduled_at.lte.${end},published_at.lte.${end}`)
      .limit(200);

    if (!error && data) {
      setArticles(data);
    }
    setLoading(false);
  };

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Pad start to align with weekday (Sun=0)
    const startDay = monthStart.getDay();
    const paddedDays: (Date | null)[] = Array(startDay).fill(null).concat(allDays);

    return paddedDays;
  }, [currentMonth]);

  const getArticlesForDay = (day: Date) => {
    return articles.filter(a => {
      const date = a.scheduled_at || a.published_at;
      return date && isSameDay(new Date(date), day);
    });
  };

  const handleDrop = async (articleId: string, newDate: Date) => {
    const { error } = await supabase
      .from('articles')
      .update({ scheduled_at: newDate.toISOString() })
      .eq('id', articleId);

    if (error) {
      toast.error('Erro ao reagendar artigo');
    } else {
      toast.success('Artigo reagendado!');
      fetchArticles();
    }
  };

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <CardTitle>Calendário de Conteúdo</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
            </span>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {/* Week day headers */}
            {weekDays.map(d => (
              <div key={d} className="bg-muted/50 text-center py-2 text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}

            {/* Day cells */}
            {days.map((day, i) => (
              <div
                key={i}
                className={`bg-background min-h-[90px] p-1.5 ${
                  day && isToday(day) ? 'ring-1 ring-inset ring-primary' : ''
                } ${!day ? 'bg-muted/20' : ''}`}
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bg-primary/5'); }}
                onDragLeave={e => { e.currentTarget.classList.remove('bg-primary/5'); }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('bg-primary/5');
                  const articleId = e.dataTransfer.getData('articleId');
                  if (day && articleId) handleDrop(articleId, day);
                }}
              >
                {day && (
                  <>
                    <span className={`text-xs ${isToday(day) ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
                      {format(day, 'd')}
                    </span>
                    <div className="space-y-0.5 mt-0.5">
                      {getArticlesForDay(day).slice(0, 3).map(a => (
                        <div
                          key={a.id}
                          draggable
                          onDragStart={e => e.dataTransfer.setData('articleId', a.id)}
                          className={`text-[10px] leading-tight px-1 py-0.5 rounded cursor-grab truncate ${
                            STATUS_COLORS[a.status || 'draft'] || STATUS_COLORS.draft
                          }`}
                          title={a.title}
                        >
                          {a.title}
                        </div>
                      ))}
                      {getArticlesForDay(day).length > 3 && (
                        <span className="text-[10px] text-muted-foreground pl-1">
                          +{getArticlesForDay(day).length - 3}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div className="flex gap-4 mt-4 flex-wrap">
          {Object.entries({ published: 'Publicado', draft: 'Rascunho', scheduled: 'Agendado', generating: 'Gerando' }).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5 text-xs">
              <div className={`h-2.5 w-2.5 rounded-sm ${STATUS_COLORS[k]?.split(' ')[0]}`} />
              <span className="text-muted-foreground">{v}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
