import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBlog } from '@/hooks/useBlog';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Rocket, 
  Eye, 
  Pause, 
  Calendar, 
  Loader2, 
  ArrowRight,
  Sparkles,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  CalendarClock,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';

type AutomationMode = 'manual' | 'suggest' | 'auto';

interface QueueStats {
  total: number;
  pending: number;
  generated: number;
}

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: '1 artigo por semana', articlesPerPeriod: 1, frequency: 'weekly' },
  { value: 'biweekly', label: '2 artigos por semana', articlesPerPeriod: 2, frequency: 'weekly' },
  { value: 'daily', label: 'Diário', articlesPerPeriod: 7, frequency: 'weekly' },
];

const CONTENT_TYPE_OPTIONS = [
  { value: 'educational', label: 'Educacional', description: 'Ensina conceitos ao seu público' },
  { value: 'seo_local', label: 'SEO Local', description: 'Otimizado para buscas da região' },
  { value: 'authority', label: 'Autoridade', description: 'Posiciona você como especialista' },
  { value: 'mixed', label: 'Misto', description: 'Combina todas as estratégias' },
];

const MODE_CONFIG = {
  manual: {
    icon: Pause,
    title: 'Manual',
    description: 'Você cria os artigos por conta própria',
    microcopy: 'Sua máquina de vendas fica parada',
    badge: 'Desligado',
    badgeVariant: 'secondary' as const,
  },
  suggest: {
    icon: Eye,
    title: 'Copiloto',
    description: 'Gera artigos para você revisar antes de publicar',
    microcopy: 'Você ainda precisa aprovar cada artigo',
    badge: 'Revisão',
    badgeVariant: 'outline' as const,
  },
  auto: {
    icon: Rocket,
    title: 'Piloto Automático',
    description: 'Publica sozinho, todos os dias, sem você precisar fazer nada',
    microcopy: 'Sua máquina trabalha 24/7 por você',
    badge: '✨ Recomendado',
    badgeVariant: 'default' as const,
  },
};

export default function ClientAutomation() {
  const { blog } = useBlog();
  const navigate = useNavigate();
  const { formatDateShort } = useLocaleFormat();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<AutomationMode>('manual');
  const [frequency, setFrequency] = useState('weekly');
  const [contentType, setContentType] = useState('mixed');
  const [queueStats, setQueueStats] = useState<QueueStats>({ total: 0, pending: 0, generated: 0 });
  const [usageData, setUsageData] = useState({ articles_generated: 0, images_generated: 0 });
  const [nextPublication, setNextPublication] = useState<Date | null>(null);

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
          setMode((automation.mode as AutomationMode) || 'manual');
          setContentType(automation.content_type || 'mixed');
          
          if (automation.frequency === 'daily') {
            setFrequency('daily');
          } else if (automation.articles_per_period === 2) {
            setFrequency('biweekly');
          } else {
            setFrequency('weekly');
          }
        }

        // Fetch queue stats
        const { data: queue } = await supabase
          .from('article_queue')
          .select('status')
          .eq('blog_id', blog.id);

        if (queue) {
          setQueueStats({
            total: queue.length,
            pending: queue.filter(q => q.status === 'pending').length,
            generated: queue.filter(q => q.status === 'generated').length,
          });
        }

        // Fetch usage tracking for this month
        const currentMonth = new Date().toISOString().substring(0, 7) + '-01';
        const { data: usage } = await supabase
          .from('usage_tracking')
          .select('articles_generated, images_generated')
          .eq('user_id', blog.user_id)
          .eq('month', currentMonth)
          .maybeSingle();

        if (usage) {
          setUsageData({
            articles_generated: usage.articles_generated || 0,
            images_generated: usage.images_generated || 0,
          });
        }

        // Fetch next scheduled publication
        const { data: nextItem } = await supabase
          .from('article_queue')
          .select('scheduled_for')
          .eq('blog_id', blog.id)
          .eq('status', 'pending')
          .not('scheduled_for', 'is', null)
          .order('scheduled_for', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (nextItem?.scheduled_for) {
          setNextPublication(new Date(nextItem.scheduled_for));
        }
      } catch (error) {
        console.error('Error fetching automation data:', error);
      }

      setLoading(false);
    };

    fetchData();
  }, [blog?.id]);

  const handleModeChange = async (newMode: AutomationMode) => {
    if (!blog?.id) return;
    setSaving(true);
    const previousMode = mode;
    setMode(newMode);

    try {
      const freqOption = FREQUENCY_OPTIONS.find(f => f.value === frequency)!;

      const { error } = await supabase
        .from('blog_automation')
        .upsert({
          blog_id: blog.id,
          mode: newMode,
          is_active: newMode !== 'manual',
          content_type: contentType,
          frequency: frequency === 'daily' ? 'daily' : 'weekly',
          articles_per_period: freqOption.articlesPerPeriod,
          auto_publish: newMode === 'auto',
          generate_images: true,
        }, { onConflict: 'blog_id' });

      if (error) throw error;

      const messages = {
        manual: '⚠️ Máquina de vendas desligada',
        suggest: '👍 Modo Copiloto ativado! Artigos gerados aguardam sua aprovação.',
        auto: '🚀 Piloto Automático ativado! Sua máquina está trabalhando por você.',
      };

      toast.success(messages[newMode]);
    } catch (error) {
      console.error('Error updating mode:', error);
      setMode(previousMode);
      toast.error('Erro ao atualizar modo');
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
          mode,
          is_active: mode !== 'manual',
          content_type: contentType,
          frequency: value === 'daily' ? 'daily' : 'weekly',
          articles_per_period: freqOption.articlesPerPeriod,
          auto_publish: mode === 'auto',
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

  const handleContentTypeChange = async (value: string) => {
    if (!blog?.id) return;
    setSaving(true);
    setContentType(value);

    try {
      const freqOption = FREQUENCY_OPTIONS.find(f => f.value === frequency)!;

      const { error } = await supabase
        .from('blog_automation')
        .upsert({
          blog_id: blog.id,
          mode,
          is_active: mode !== 'manual',
          content_type: value,
          frequency: frequency === 'daily' ? 'daily' : 'weekly',
          articles_per_period: freqOption.articlesPerPeriod,
          auto_publish: mode === 'auto',
          generate_images: true,
        }, { onConflict: 'blog_id' });

      if (error) throw error;
      toast.success('Tipo de conteúdo atualizado!');
    } catch (error) {
      console.error('Error updating content type:', error);
      toast.error('Erro ao atualizar tipo de conteúdo');
    } finally {
      setSaving(false);
    }
  };

  const getModeContextualMessage = () => {
    switch (mode) {
      case 'manual':
        return {
          icon: AlertTriangle,
          color: 'text-amber-500',
          bg: 'bg-amber-500/10 border-amber-500/20',
          message: 'Sua máquina de aquisição de clientes está desligada. Enquanto isso, seus concorrentes estão publicando.',
        };
      case 'suggest':
        return {
          icon: Eye,
          color: 'text-blue-500',
          bg: 'bg-blue-500/10 border-blue-500/20',
          message: 'Bom começo! Você recebe artigos prontos para revisar. Dica: Com o Piloto Automático, você economiza ainda mais tempo.',
        };
      case 'auto':
        return {
          icon: CheckCircle2,
          color: 'text-emerald-500',
          bg: 'bg-emerald-500/10 border-emerald-500/20',
          message: 'Perfeito! Sua máquina está trabalhando por você 24/7. Artigos serão publicados automaticamente.',
        };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const contextMessage = getModeContextualMessage();
  const ContextIcon = contextMessage.icon;

  return (
    <div className="space-y-8">
      {/* Header Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-accent mb-2">
          <Rocket className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-foreground">
          Sua Máquina de Aquisição de Clientes
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto">
          Você não está criando posts. Está ativando um motor que trabalha por você.
        </p>
      </div>

      {/* Contextual Message */}
      <Card className={cn("border", contextMessage.bg)}>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <ContextIcon className={cn("h-5 w-5 shrink-0", contextMessage.color)} />
            <p className="text-sm text-foreground">{contextMessage.message}</p>
          </div>
        </CardContent>
      </Card>

      {/* Mode Selection */}
      <Card className="client-card overflow-hidden">
        <CardHeader>
          <CardTitle>Modo de Operação</CardTitle>
          <CardDescription>Como você quer que sua máquina trabalhe?</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={mode}
            onValueChange={(v) => handleModeChange(v as AutomationMode)}
            className="space-y-4"
            disabled={saving}
          >
            {/* Auto Mode - DOMINANT */}
            <label
              className={cn(
                "relative flex items-start gap-4 p-5 rounded-xl cursor-pointer transition-all duration-300",
                mode === 'auto'
                  ? "bg-gradient-to-br from-primary/20 via-primary/10 to-accent/10 ring-2 ring-primary shadow-lg shadow-primary/20 scale-[1.02]"
                  : "bg-muted/30 hover:bg-muted/50 border border-border",
              )}
            >
              <RadioGroupItem value="auto" id="auto" className="mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Rocket className={cn(
                    "h-5 w-5",
                    mode === 'auto' ? "text-primary animate-pulse" : "text-muted-foreground"
                  )} />
                  <span className="font-semibold text-lg text-foreground">{MODE_CONFIG.auto.title}</span>
                  <Badge className="bg-gradient-to-r from-primary to-accent text-white border-0">
                    {MODE_CONFIG.auto.badge}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1">{MODE_CONFIG.auto.description}</p>
                <p className={cn(
                  "text-xs mt-2",
                  mode === 'auto' ? "text-primary" : "text-muted-foreground/70"
                )}>
                  {MODE_CONFIG.auto.microcopy}
                </p>
              </div>
            </label>

            {/* Suggest Mode - INTERMEDIATE */}
            <label
              className={cn(
                "relative flex items-start gap-4 p-5 rounded-xl cursor-pointer transition-all duration-200",
                mode === 'suggest'
                  ? "bg-blue-500/10 ring-2 ring-blue-500/50"
                  : "bg-muted/30 hover:bg-muted/50 border border-border",
              )}
            >
              <RadioGroupItem value="suggest" id="suggest" className="mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Eye className={cn(
                    "h-5 w-5",
                    mode === 'suggest' ? "text-blue-500" : "text-muted-foreground"
                  )} />
                  <span className="font-medium text-foreground">{MODE_CONFIG.suggest.title}</span>
                  <Badge variant="outline" className="border-blue-500/50 text-blue-600 dark:text-blue-400">
                    {MODE_CONFIG.suggest.badge}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1 text-sm">{MODE_CONFIG.suggest.description}</p>
                <p className="text-xs text-muted-foreground/70 mt-2">{MODE_CONFIG.suggest.microcopy}</p>
              </div>
            </label>

            {/* Manual Mode - DISCOURAGED */}
            <label
              className={cn(
                "relative flex items-start gap-4 p-5 rounded-xl cursor-pointer transition-all duration-200",
                mode === 'manual'
                  ? "bg-muted/50 ring-1 ring-border"
                  : "bg-muted/20 hover:bg-muted/30 border border-dashed border-border/50 opacity-70",
              )}
            >
              <RadioGroupItem value="manual" id="manual" className="mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Pause className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium text-muted-foreground">{MODE_CONFIG.manual.title}</span>
                  <Badge variant="secondary" className="opacity-70">
                    {MODE_CONFIG.manual.badge}
                  </Badge>
                </div>
                <p className="text-muted-foreground/80 mt-1 text-sm">{MODE_CONFIG.manual.description}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{MODE_CONFIG.manual.microcopy}</p>
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Configuration Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Content Type */}
        <Card className="client-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              Tipo de Conteúdo
            </CardTitle>
            <CardDescription>Qual estratégia combina com seu negócio?</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={contentType} onValueChange={handleContentTypeChange} disabled={saving}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Frequency */}
        <Card className="client-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Frequência
            </CardTitle>
            <CardDescription>Quantos artigos por semana?</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={frequency} onValueChange={handleFrequencyChange} className="space-y-2" disabled={saving}>
              {FREQUENCY_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                    frequency === option.value
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-muted/30 hover:bg-muted/50 border border-transparent"
                  )}
                >
                  <RadioGroupItem value={option.value} id={option.value} />
                  <span className="text-sm text-foreground">{option.label}</span>
                </label>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="client-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{usageData.articles_generated}</p>
                <p className="text-sm text-muted-foreground">Artigos este mês</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="client-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent/10">
                <ImageIcon className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{usageData.images_generated}</p>
                <p className="text-sm text-muted-foreground">Imagens este mês</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="client-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-500/10">
                <Clock className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{queueStats.pending}</p>
                <p className="text-sm text-muted-foreground">Na fila</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="client-card">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <CalendarClock className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {nextPublication ? formatDateShort(nextPublication) : '—'}
                </p>
                <p className="text-sm text-muted-foreground">Próxima publicação</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CTA to Queue */}
      <Card className="client-card client-card-glow overflow-hidden">
        <CardContent className="py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-foreground">Fila de Produção</h3>
              <p className="text-sm text-muted-foreground">
                Veja tudo que está sendo preparado para o seu blog
              </p>
            </div>
            <Button
              onClick={() => navigate('/client/queue')}
              className="client-btn-primary gap-2 shrink-0"
            >
              Ver Fila de Produção
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2 text-foreground">🤖 Como funciona?</h3>
          <p className="text-sm text-muted-foreground">
            Sua máquina analisa o perfil da empresa e cria artigos relevantes automaticamente.
            Cada artigo é otimizado para o Google e, dependendo do modo escolhido, publicado
            automaticamente ou enviado para sua aprovação.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
