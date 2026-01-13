import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Bell, Mail, MessageCircle, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChannelConfig {
  inApp: boolean;
  email: boolean;
  emailAddress?: string;
  whatsapp: boolean;
  whatsappNumber?: string;
}

interface ChannelToggleProps {
  config: ChannelConfig;
  onChange: (config: ChannelConfig) => void;
}

export function ChannelToggle({ config, onChange }: ChannelToggleProps) {
  const channels = [
    {
      key: 'inApp' as const,
      icon: Smartphone,
      label: 'No App',
      description: 'Receba notificações dentro da plataforma',
      hasInput: false
    },
    {
      key: 'email' as const,
      icon: Mail,
      label: 'Email',
      description: config.emailAddress || 'Informe seu email abaixo',
      hasInput: true,
      inputKey: 'emailAddress' as const,
      inputPlaceholder: 'seu@email.com',
      inputType: 'email'
    },
    {
      key: 'whatsapp' as const,
      icon: MessageCircle,
      label: 'WhatsApp',
      description: config.whatsappNumber ? `+${config.whatsappNumber}` : 'Configure seu número',
      hasInput: true,
      inputKey: 'whatsappNumber' as const,
      inputPlaceholder: '5511999999999',
      inputType: 'tel'
    }
  ];

  return (
    <Card className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Canais de Notificação
        </CardTitle>
        <CardDescription>
          Escolha como deseja receber alertas de oportunidades
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {channels.map((channel) => (
          <div 
            key={channel.key}
            className={cn(
              "p-4 rounded-lg border transition-colors",
              config[channel.key]
                ? "border-primary/50 bg-primary/5"
                : "border-slate-200 dark:border-white/10"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  config[channel.key] ? "bg-primary/10" : "bg-gray-100 dark:bg-white/5"
                )}>
                  <channel.icon className={cn(
                    "h-5 w-5",
                    config[channel.key] ? "text-primary" : "text-gray-500"
                  )} />
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {channel.label}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {channel.description}
                  </p>
                </div>
              </div>
              <Switch
                checked={config[channel.key]}
                onCheckedChange={(checked) => 
                  onChange({ ...config, [channel.key]: checked })
                }
              />
            </div>
            
            {channel.hasInput && config[channel.key] && (
              <div className="mt-3 pl-12">
                <Input
                  type={channel.inputType}
                  placeholder={channel.inputPlaceholder}
                  value={config[channel.inputKey!] || ''}
                  onChange={(e) => 
                    onChange({ 
                      ...config, 
                      [channel.inputKey!]: channel.inputType === 'tel' 
                        ? e.target.value.replace(/\D/g, '') 
                        : e.target.value 
                    })
                  }
                  className="max-w-xs"
                />
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
