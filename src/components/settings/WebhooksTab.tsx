import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Webhook, Plus, Trash2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface WebhookConfig {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggered: string | null;
}

const AVAILABLE_EVENTS = [
  { id: 'article.created', label: 'Artigo criado' },
  { id: 'article.published', label: 'Artigo publicado' },
  { id: 'article.updated', label: 'Artigo atualizado' },
  { id: 'opportunity.created', label: 'Oportunidade criada' },
  { id: 'generation.completed', label: 'Geração concluída' },
];

export function WebhooksTab() {
  const [webhooks] = useState<WebhookConfig[]>([]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Webhook className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Webhooks</CardTitle>
                <CardDescription>
                  Configure endpoints para receber notificações de eventos
                </CardDescription>
              </div>
            </div>
            <Button className="gap-2" onClick={() => toast.info('Em breve: configuração de webhooks')}>
              <Plus className="h-4 w-4" />
              Novo Webhook
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhum webhook configurado</p>
              <p className="text-sm">Adicione webhooks para receber eventos em tempo real.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map(wh => (
                <div key={wh.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {wh.isActive ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <code className="text-sm">{wh.url}</code>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {wh.events.map(ev => (
                        <Badge key={ev} variant="secondary" className="text-xs">{ev}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-4 rounded-lg bg-muted/50">
            <h4 className="text-sm font-medium mb-2">Eventos disponíveis</h4>
            <div className="grid grid-cols-2 gap-2">
              {AVAILABLE_EVENTS.map(ev => (
                <div key={ev.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {ev.label}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
