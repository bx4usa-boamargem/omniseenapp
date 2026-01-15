import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Rocket, 
  Eye, 
  Pause, 
  Loader2,
  CheckCircle2,
  Clock,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type AutomationMode = 'manual' | 'suggest' | 'auto';

interface MobileAutomationConfigProps {
  blogId: string;
}

const MODE_CONFIG = {
  manual: {
    icon: Pause,
    title: 'Manual',
    description: 'Você cria os artigos',
    color: 'border-gray-300 bg-gray-50 dark:bg-gray-900/50',
    activeColor: 'border-gray-500 bg-gray-100 dark:bg-gray-800',
  },
  suggest: {
    icon: Eye,
    title: 'Copiloto',
    description: 'Gera para você revisar',
    color: 'border-blue-200 bg-blue-50 dark:bg-blue-900/20',
    activeColor: 'border-blue-500 bg-blue-100 dark:bg-blue-900/40',
  },
  auto: {
    icon: Rocket,
    title: 'Automático',
    description: 'Publica sozinho 24/7',
    color: 'border-green-200 bg-green-50 dark:bg-green-900/20',
    activeColor: 'border-green-500 bg-green-100 dark:bg-green-900/40',
    recommended: true,
  },
};

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: '1x semana', description: '1 artigo por semana' },
  { value: 'biweekly', label: '2x semana', description: '2 artigos por semana' },
  { value: 'daily', label: 'Diário', description: '1 artigo por dia' },
];

const TIME_OPTIONS = [
  { value: '06:00', label: '06:00' },
  { value: '09:00', label: '09:00' },
  { value: '12:00', label: '12:00' },
  { value: '18:00', label: '18:00' },
  { value: '21:00', label: '21:00' },
];

const CONTENT_OPTIONS = [
  { value: 'educational', label: 'Educacional' },
  { value: 'seo_local', label: 'SEO Local' },
  { value: 'authority', label: 'Autoridade' },
  { value: 'mixed', label: 'Misto' },
];

export function MobileAutomationConfig({ blogId }: MobileAutomationConfigProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<AutomationMode>('manual');
  const [frequency, setFrequency] = useState('weekly');
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [contentType, setContentType] = useState('mixed');

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('blog_automation')
        .select('*')
        .eq('blog_id', blogId)
        .maybeSingle();

      if (data) {
        setMode((data.mode as AutomationMode) || 'manual');
        setContentType(data.content_type || 'mixed');
        setPreferredTime(data.preferred_time || '09:00');
        
        if (data.frequency === 'daily') {
          setFrequency('daily');
        } else if (data.articles_per_period === 2) {
          setFrequency('biweekly');
        } else {
          setFrequency('weekly');
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [blogId]);

  const handleModeChange = async (newMode: AutomationMode) => {
    setSaving(true);
    const previousMode = mode;
    setMode(newMode);

    try {
      const freqOption = FREQUENCY_OPTIONS.find(f => f.value === frequency)!;
      const articlesPerPeriod = frequency === 'daily' ? 7 : frequency === 'biweekly' ? 2 : 1;

      const { error } = await supabase
        .from('blog_automation')
        .upsert({
          blog_id: blogId,
          mode: newMode,
          is_active: newMode !== 'manual',
          content_type: contentType,
          frequency: frequency === 'daily' ? 'daily' : 'weekly',
          articles_per_period: articlesPerPeriod,
          auto_publish: newMode === 'auto',
          generate_images: true,
          preferred_time: preferredTime,
        }, { onConflict: 'blog_id' });

      if (error) throw error;

      const messages = {
        manual: 'Máquina desligada',
        suggest: 'Modo Copiloto ativado',
        auto: '🚀 Piloto Automático ativado!',
      };
      toast.success(messages[newMode]);
    } catch (error) {
      console.error('Error updating mode:', error);
      setMode(previousMode);
      toast.error('Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleFrequencyChange = async (value: string) => {
    setSaving(true);
    setFrequency(value);

    try {
      const articlesPerPeriod = value === 'daily' ? 7 : value === 'biweekly' ? 2 : 1;

      await supabase
        .from('blog_automation')
        .upsert({
          blog_id: blogId,
          mode,
          is_active: mode !== 'manual',
          content_type: contentType,
          frequency: value === 'daily' ? 'daily' : 'weekly',
          articles_per_period: articlesPerPeriod,
          auto_publish: mode === 'auto',
          generate_images: true,
          preferred_time: preferredTime,
        }, { onConflict: 'blog_id' });

      toast.success('Frequência atualizada');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleTimeChange = async (value: string) => {
    setSaving(true);
    setPreferredTime(value);

    try {
      await supabase
        .from('blog_automation')
        .update({ preferred_time: value })
        .eq('blog_id', blogId);

      toast.success('Horário atualizado');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  };

  const handleContentChange = async (value: string) => {
    setSaving(true);
    setContentType(value);

    try {
      await supabase
        .from('blog_automation')
        .update({ content_type: value })
        .eq('blog_id', blogId);

      toast.success('Tipo de conteúdo atualizado');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Erro ao atualizar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent">
          <Rocket className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Sua Máquina</h1>
        <p className="text-sm text-muted-foreground">Configure como a automação funciona</p>
      </div>

      {/* Mode Selection Card */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Modo de Operação</h3>
        </div>

        <div className="space-y-2">
          {(Object.entries(MODE_CONFIG) as [AutomationMode, typeof MODE_CONFIG.manual][]).map(([key, config]) => {
            const Icon = config.icon;
            const isActive = mode === key;
            
            return (
              <button
                key={key}
                onClick={() => handleModeChange(key)}
                disabled={saving}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all touch-manipulation",
                  isActive ? config.activeColor : config.color,
                  saving && "opacity-50"
                )}
              >
                <Icon className={cn(
                  "h-6 w-6 shrink-0",
                  isActive ? "text-primary" : "text-muted-foreground"
                )} />
                <div className="text-left flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{config.title}</span>
                    {'recommended' in config && config.recommended && (
                      <Badge className="bg-primary/20 text-primary text-[10px]">✨ Recomendado</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                </div>
                {isActive && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Frequency Card */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Frequência</h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {FREQUENCY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleFrequencyChange(option.value)}
              disabled={saving}
              className={cn(
                "p-3 rounded-xl border-2 transition-all touch-manipulation",
                frequency === option.value 
                  ? "border-primary bg-primary/10" 
                  : "border-border bg-muted/50",
                saving && "opacity-50"
              )}
            >
              <span className={cn(
                "text-sm font-medium",
                frequency === option.value ? "text-primary" : "text-foreground"
              )}>
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Time Card */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Horário</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {TIME_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleTimeChange(option.value)}
              disabled={saving}
              className={cn(
                "px-4 py-2 rounded-lg border transition-all touch-manipulation",
                preferredTime === option.value 
                  ? "border-primary bg-primary/10 text-primary" 
                  : "border-border bg-muted/50 text-foreground",
                saving && "opacity-50"
              )}
            >
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Type Card */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Rocket className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Tipo de Conteúdo</h3>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {CONTENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handleContentChange(option.value)}
              disabled={saving}
              className={cn(
                "p-3 rounded-xl border-2 transition-all touch-manipulation",
                contentType === option.value 
                  ? "border-primary bg-primary/10" 
                  : "border-border bg-muted/50",
                saving && "opacity-50"
              )}
            >
              <span className={cn(
                "text-sm font-medium",
                contentType === option.value ? "text-primary" : "text-foreground"
              )}>
                {option.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
