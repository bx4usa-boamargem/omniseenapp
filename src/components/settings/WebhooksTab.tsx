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
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Webhook className="h-5 w-5 text-primary" />
              </div>
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
            <div className="text-center py-12 text-muted-foreground">
              <div className="p-4 rounded-full bg-muted/30 w-fit mx-auto mb-4">
                <Webhook className="h-10 w-10 opacity-40" />
              </div>
              <p className="font-medium text-foreground/80">Nenhum webhook configurado</p>
              <p className="text-sm mt-1">Adicione webhooks para receber eventos em tempo real.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map(wh => (
                <div key={wh.id} className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-muted/20 backdrop-blur-sm hover:bg-muted/30 transition-colors">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      {wh.isActive ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <code className="text-sm font-mono">{wh.url}</code>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {wh.events.map(ev => (
                        <Badge key={ev} variant="secondary" className="text-xs bg-secondary/50">{ev}</Badge>
                      ))}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 p-4 rounded-xl bg-muted/20 border border-border/30 backdrop-blur-sm">
            <h4 className="text-sm font-medium mb-3">Eventos disponíveis</h4>
            <div className="grid grid-cols-2 gap-2.5">
              {AVAILABLE_EVENTS.map(ev => (
                <div key={ev.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-primary/60" />
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
