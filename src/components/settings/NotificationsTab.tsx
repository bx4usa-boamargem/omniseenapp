import { Bell, Mail, MessageSquare, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

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

      {/* Push Notifications - Future */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notificações Push
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-normal">
              Em breve
            </span>
          </CardTitle>
          <CardDescription>
            Receba notificações em tempo real no navegador.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Ativar notificações push</Label>
            <Switch disabled />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
