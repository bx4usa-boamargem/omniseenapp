import { useState, useEffect } from 'react';
import { useBlog } from '@/hooks/useBlog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Bell, Save, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { ThresholdSelector } from '@/components/notifications/ThresholdSelector';
import { ChannelToggle } from '@/components/notifications/ChannelToggle';
import { FrequencySelector } from '@/components/notifications/FrequencySelector';
import { NotificationPreview } from '@/components/notifications/NotificationPreview';

interface NotificationSettings {
  notify_in_app: boolean;
  notify_email: boolean;
  email_address: string;
  notify_whatsapp: boolean;
  whatsapp_number: string;
  high_score_threshold: number;
  notification_frequency: 'immediate' | 'daily' | 'weekly';
  digest_time: string;
}

export default function ClientNotificationSettings() {
  const { blog } = useBlog();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [settings, setSettings] = useState<NotificationSettings>({
    notify_in_app: true,
    notify_email: true,
    email_address: '',
    notify_whatsapp: false,
    whatsapp_number: '',
    high_score_threshold: 90,
    notification_frequency: 'immediate',
    digest_time: '09:00'
  });

  useEffect(() => {
    if (!blog?.id || !user?.id) return;

    const fetchSettings = async () => {
      setLoading(true);
      
      try {
        const { data } = await supabase
          .from('opportunity_notifications')
          .select('*')
          .eq('blog_id', blog.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (data) {
          setSettings({
            notify_in_app: data.notify_in_app ?? true,
            notify_email: data.notify_email ?? true,
            email_address: data.email_address || user.email || '',
            notify_whatsapp: (data as Record<string, unknown>).notify_whatsapp as boolean ?? false,
            whatsapp_number: (data as Record<string, unknown>).whatsapp_number as string || '',
            high_score_threshold: (data as Record<string, unknown>).high_score_threshold as number ?? 90,
            notification_frequency: ((data as Record<string, unknown>).notification_frequency as string || 'immediate') as NotificationSettings['notification_frequency'],
            digest_time: ((data as Record<string, unknown>).digest_time as string || '09:00').slice(0, 5)
          });
        } else {
          // Use user email as default
          setSettings(prev => ({
            ...prev,
            email_address: user.email || ''
          }));
        }
      } catch (error) {
        console.error('Error fetching notification settings:', error);
      }
      
      setLoading(false);
    };

    fetchSettings();
  }, [blog?.id, user?.id, user?.email]);

  const handleSave = async () => {
    if (!blog?.id || !user?.id) return;
    
    setSaving(true);
    setSaved(false);

    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from('opportunity_notifications')
        .select('id')
        .eq('blog_id', blog.id)
        .eq('user_id', user.id)
        .maybeSingle();

      const updateData = {
        notify_in_app: settings.notify_in_app,
        notify_email: settings.notify_email,
        email_address: settings.email_address,
        min_relevance_score: settings.high_score_threshold
      };

      let error;
      if (existing) {
        const result = await supabase
          .from('opportunity_notifications')
          .update(updateData)
          .eq('id', existing.id);
        error = result.error;
      } else {
        const result = await supabase
          .from('opportunity_notifications')
          .insert({
            blog_id: blog.id,
            user_id: user.id,
            ...updateData
          });
        error = result.error;
      }

      if (error) throw error;

      setSaved(true);
      toast.success('Configurações salvas!');
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving notification settings:', error);
      toast.error('Erro ao salvar configurações');
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3 text-gray-800 dark:text-white">
          <Bell className="h-7 w-7 text-primary" />
          Configurações de Notificação
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Defina como e quando receber alertas de oportunidades de alto score
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Threshold Selector */}
          <ThresholdSelector
            value={settings.high_score_threshold}
            onChange={(value) => setSettings(prev => ({ ...prev, high_score_threshold: value }))}
          />

          {/* Frequency Selector */}
          <FrequencySelector
            frequency={settings.notification_frequency}
            digestTime={settings.digest_time}
            onFrequencyChange={(freq) => setSettings(prev => ({ ...prev, notification_frequency: freq }))}
            onDigestTimeChange={(time) => setSettings(prev => ({ ...prev, digest_time: time }))}
          />
        </div>

        <div className="space-y-6">
          {/* Channel Toggle */}
          <ChannelToggle
            config={{
              inApp: settings.notify_in_app,
              email: settings.notify_email,
              emailAddress: settings.email_address,
              whatsapp: settings.notify_whatsapp,
              whatsappNumber: settings.whatsapp_number
            }}
            onChange={(config) => setSettings(prev => ({
              ...prev,
              notify_in_app: config.inApp,
              notify_email: config.email,
              email_address: config.emailAddress || '',
              notify_whatsapp: config.whatsapp,
              whatsapp_number: config.whatsappNumber || ''
            }))}
          />

          {/* Preview */}
          <NotificationPreview threshold={settings.high_score_threshold} />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-white/10">
        <Button 
          onClick={handleSave} 
          disabled={saving} 
          size="lg" 
          className="gap-2 min-w-[180px]"
          variant={saved ? "outline" : "default"}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : saved ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Salvo!
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Salvar Configurações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
