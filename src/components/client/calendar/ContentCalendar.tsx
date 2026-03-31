import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBlog } from '@/hooks/useBlog';
import { toast } from 'sonner';

interface CalendarEntry {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  status: string;
  category: string | null;
  priority: string;
  color: string;
  article_id: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  generated: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  published: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planejado',
  in_progress: 'Em Progresso',
  generated: 'Gerado',
  published: 'Publicado',
  cancelled: 'Cancelado',
};

export function ContentCalendar() {
  const { blog } = useBlog();
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    priority: 'medium',
    scheduled_date: '',
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    if (blog?.id) fetchEntries();
  }, [blog?.id, year, month]);

  const fetchEntries = async () => {
    if (!blog?.id) return;
    setLoading(true);
    try {
      const startDate = new Date(year, month, 1).toISOString().slice(0, 10);
      const endDate = new Date(year, month + 1, 0).toISOString().slice(0, 10);

      const { data, error } = await supabase
        .from('content_calendar')
        .select('*')
        .eq('blog_id', blog.id)
        .gte('scheduled_date', startDate)
        .lte('scheduled_date', endDate)
        .order('scheduled_date');

      if (!error) setEntries((data as CalendarEntry[]) || []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(d);
    return days;
  }, [firstDayOfWeek, daysInMonth]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      const date = entry.scheduled_date;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(entry);
    }
    return map;
  }, [entries]);

  const handleAddEntry = async () => {
    if (!blog?.id || !formData.title || !formData.scheduled_date) {
      toast.error('Preencha título e data');
      return;
    }

    try {
      const { error } = await supabase.from('content_calendar').insert({
        blog_id: blog.id,
        title: formData.title,
        description: formData.description || null,
        category: formData.category || null,
        priority: formData.priority,
        scheduled_date: formData.scheduled_date,
      });

      if (error) throw error;
      toast.success('Entrada adicionada ao calendário');
      setShowAddDialog(false);
      setFormData({ title: '', description: '', category: '', priority: 'medium', scheduled_date: '' });
      fetchEntries();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar');
    }
  };

  const handleDayClick = (day: number) => {
    const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(date);
    setFormData({ ...formData, scheduled_date: date });
    setShowAddDialog(true);
  };

  const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Calendário de Conteúdo
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(year, month - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium capitalize min-w-[160px] text-center">{monthName}</span>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(year, month + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" className="gap-1 ml-2" onClick={() => { setFormData({ ...formData, scheduled_date: today }); setShowAddDialog(true); }}>
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {weekDays.map((day) => (
              <div key={day} className="bg-muted/50 p-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            {calendarDays.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="bg-background min-h-[80px] p-1" />;
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEntries = entriesByDate.get(dateStr) || [];
              const isToday = dateStr === today;

              return (
                <div
                  key={day}
                  className={`bg-background min-h-[80px] p-1 cursor-pointer hover:bg-muted/30 transition-colors ${isToday ? 'ring-2 ring-primary ring-inset' : ''}`}
                  onClick={() => handleDayClick(day)}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEntries.slice(0, 3).map((entry) => (
                      <div
                        key={entry.id}
                        className="text-[10px] leading-tight px-1 py-0.5 rounded truncate"
                        style={{ backgroundColor: entry.color + '20', color: entry.color, borderLeft: `2px solid ${entry.color}` }}
                        title={entry.title}
                      >
                        {entry.title}
                      </div>
                    ))}
                    {dayEntries.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1">+{dayEntries.length - 3} mais</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar ao Calendário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Título do artigo planejado"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Notas sobre este conteúdo..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ex: Tutorial, Case, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAddEntry}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
