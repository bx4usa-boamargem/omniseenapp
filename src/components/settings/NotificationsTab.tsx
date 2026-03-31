import { useState, useEffect } from 'react';
import { Bell, Mail, MessageSquare, Zap, Phone, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBlog } from '@/hooks/useBlog';

interface NotificationSetting {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
}

const NOTIFICATION_SETTINGS: NotificationSetting[] = [
  {
    id: 'email-articles',
    label: 'Artigos publicados',
    description: 'Receba um e-mail quando um artigo for publicado automaticamente.',
    icon: Mail,
    enabled: true,
  },
  {
    id: 'email-leads',
    label: 'Novos leads',
    description: 'Seja notificado quando um novo lead for capturado.',
    icon: MessageSquare,
    enabled: true,
  },
  {
    id: 'email-automation',
    label: 'Status da automação',
    description: 'Atualizações sobre a fila de produção e automações.',
    icon: Zap,
    enabled: false,
  },
  {
    id: 'email-marketing',
    label: 'Novidades e dicas',
    description: 'Receba dicas de SEO e atualizações da plataforma.',
    icon: Bell,
    enabled: true,
  },
];

export function NotificationsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Preferências de Notificação</h3>
        <p className="text-sm text-muted-foreground">
          Escolha como e quando deseja ser notificado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Notificações por E-mail
          </CardTitle>
          <CardDescription>
            Gerencie os e-mails que você recebe da plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {NOTIFICATION_SETTINGS.map((setting) => {
              const Icon = setting.icon;
              return (
                <div 
                  key={setting.id} 
                  className="flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 p-2 rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <Label htmlFor={setting.id} className="text-sm font-medium cursor-pointer">
                        {setting.label}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {setting.description}
                      </p>
                    </div>
                  </div>
                  <Switch 
                    id={setting.id} 
                    defaultChecked={setting.enabled}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <WhatsAppReportCard />
    </div>
  );
}

function WhatsAppReportCard() {
  const { blog } = useBlog();
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!blog?.id) return;
    supabase
      .from('weekly_report_settings')
      .select('whatsapp_number')
      .eq('blog_id', blog.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.whatsapp_number) setPhone(data.whatsapp_number);
        setLoaded(true);
      });
  }, [blog?.id]);

  const handleSave = async () => {
    if (!blog?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('weekly_report_settings')
        .upsert({
          blog_id: blog.id,
          whatsapp_number: phone || null,
          is_enabled: true,
        }, { onConflict: 'blog_id' });
      if (error) throw error;
      toast.success('Número WhatsApp salvo com sucesso');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Relatório Semanal por WhatsApp
        </CardTitle>
        <CardDescription>
          Receba um resumo semanal de performance do seu blog diretamente no WhatsApp.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="whatsapp-number">Número do WhatsApp (com DDD)</Label>
          <div className="flex gap-2">
            <Input
              id="whatsapp-number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5511999999999"
              className="max-w-xs"
            />
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Formato: código do país + DDD + número. Ex: 5511999999999
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
