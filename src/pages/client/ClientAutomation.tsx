import { useEffect, useState } from 'react';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Zap, Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface QueueItem {
  id: string;
  suggested_theme: string;
  scheduled_for: string | null;
  status: string;
}

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: '1 artigo por semana', articlesPerPeriod: 1, frequency: 'weekly' },
  { value: 'biweekly', label: '2 artigos por semana', articlesPerPeriod: 2, frequency: 'weekly' },
  { value: 'daily', label: 'Diário', articlesPerPeriod: 7, frequency: 'weekly' },
];

export default function ClientAutomation() {
  const { blog } = useBlog();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [frequency, setFrequency] = useState('weekly');
  const [nextPublications, setNextPublications] = useState<QueueItem[]>([]);

  useEffect(() => {
    if (!blog?.id) return;

    const fetchData = async () => {
      setLoading(true);

      try {
        // Fetch automation settings
        const { data: automation } = await supabase
          .from('blog_automation')
          .select('*')
          .eq('blog_id', blog.id)
          .maybeSingle();

        if (automation) {
          setIsActive(automation.is_active ?? false);
          // Map database values to frequency options
          if (automation.frequency === 'daily') {
            setFrequency('daily');
          } else if (automation.articles_per_period === 2) {
            setFrequency('biweekly');
          } else {
            setFrequency('weekly');
          }
        }

        // Fetch queue
        const { data: queue } = await supabase
          .from('article_queue')
          .select('id, suggested_theme, scheduled_for, status')
          .eq('blog_id', blog.id)
          .in('status', ['pending', 'scheduled'])
          .order('scheduled_for', { ascending: true })
          .limit(5);

        setNextPublications(queue ?? []);
      } catch (error) {
        console.error('Error fetching automation data:', error);
      }

      setLoading(false);
    };

    fetchData();
  }, [blog?.id]);

  const handleToggle = async (active: boolean) => {
    if (!blog?.id) return;
    setSaving(true);
    setIsActive(active);

    try {
      const freqOption = FREQUENCY_OPTIONS.find(f => f.value === frequency)!;

      const { error } = await supabase
        .from('blog_automation')
        .upsert({
          blog_id: blog.id,
          is_active: active,
          frequency: frequency === 'daily' ? 'daily' : 'weekly',
          articles_per_period: freqOption.articlesPerPeriod,
          auto_publish: true,
          generate_images: true,
        }, { onConflict: 'blog_id' });

      if (error) throw error;

      toast.success(active ? 'Automação ativada!' : 'Automação pausada');
    } catch (error) {
      console.error('Error updating automation:', error);
      setIsActive(!active); // Revert
      toast.error('Erro ao atualizar automação');
    } finally {
      setSaving(false);
    }
  };

  const handleFrequencyChange = async (value: string) => {
    if (!blog?.id) return;
    setSaving(true);
    setFrequency(value);

    try {
      const freqOption = FREQUENCY_OPTIONS.find(f => f.value === value)!;

      const { error } = await supabase
        .from('blog_automation')
        .upsert({
          blog_id: blog.id,
          is_active: isActive,
          frequency: value === 'daily' ? 'daily' : 'weekly',
          articles_per_period: freqOption.articlesPerPeriod,
          auto_publish: true,
          generate_images: true,
        }, { onConflict: 'blog_id' });

      if (error) throw error;

      toast.success('Frequência atualizada!');
    } catch (error) {
      console.error('Error updating frequency:', error);
      toast.error('Erro ao atualizar frequência');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Zap className="h-8 w-8 text-primary" />
          Automação
        </h1>
        <p className="text-muted-foreground mt-1">
          Deixe o robô trabalhar por você
        </p>
      </div>

      {/* Main Toggle */}
      <Card className="border-2">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Sua automação está:</h2>
              <p className="text-muted-foreground mt-1">
                {isActive 
                  ? 'Artigos são criados automaticamente para você' 
                  : 'Ative para o robô começar a trabalhar'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge 
                variant={isActive ? "default" : "secondary"}
                className={isActive ? "bg-green-500 text-lg px-4 py-1" : "text-lg px-4 py-1"}
              >
                {isActive ? 'ATIVA' : 'PAUSADA'}
              </Badge>
              <Switch
                checked={isActive}
                onCheckedChange={handleToggle}
                disabled={saving}
                className="scale-125"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Frequency */}
      <Card>
        <CardHeader>
          <CardTitle>Frequência</CardTitle>
          <CardDescription>Quantos artigos você quer por semana?</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={frequency} onValueChange={handleFrequencyChange} className="space-y-3">
            {FREQUENCY_OPTIONS.map((option) => (
              <div 
                key={option.value}
                className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                onClick={() => handleFrequencyChange(option.value)}
              >
                <RadioGroupItem value={option.value} id={option.value} />
                <Label htmlFor={option.value} className="text-base cursor-pointer flex-1">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Next Publications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Próximas Publicações
          </CardTitle>
          <CardDescription>
            Artigos que serão publicados automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          {nextPublications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma publicação agendada</p>
              <p className="text-sm mt-1">
                {isActive 
                  ? 'Os artigos serão agendados em breve' 
                  : 'Ative a automação para agendar artigos'}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {nextPublications.map((item) => (
                <li 
                  key={item.id} 
                  className="flex items-center justify-between py-3 px-4 border rounded-lg"
                >
                  <span className="font-medium truncate flex-1 mr-4">
                    {item.suggested_theme}
                  </span>
                  {item.scheduled_for && (
                    <Badge variant="outline" className="shrink-0">
                      {format(new Date(item.scheduled_for), "dd MMM", { locale: ptBR })}
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/50 border-dashed">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">🤖 Como funciona?</h3>
          <p className="text-sm text-muted-foreground">
            O robô analisa o perfil da sua empresa e cria artigos relevantes automaticamente.
            Cada artigo é otimizado para o Google e publicado no seu blog sem você precisar fazer nada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
