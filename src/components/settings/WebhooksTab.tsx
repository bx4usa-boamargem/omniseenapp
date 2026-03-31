import { useState, useEffect } from 'react';
import { Webhook, Plus, Trash2, Loader2, Save, TestTube2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useBlog } from '@/hooks/useBlog';

const AVAILABLE_EVENTS = [
  { value: 'article.published', label: 'Artigo publicado' },
  { value: 'article.updated', label: 'Artigo atualizado' },
  { value: 'article.deleted', label: 'Artigo excluído' },
  { value: 'article.generated', label: 'Artigo gerado' },
  { value: 'lead.created', label: 'Lead criado' },
  { value: 'seo.score_changed', label: 'Score SEO alterado' },
];

interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  is_active: boolean;
  description: string | null;
  secret: string | null;
  created_at: string;
}

export function WebhooksTab() {
  const { blog } = useBlog();
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ url: '', description: '', secret: '', events: [] as string[] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (blog?.id) fetchEndpoints();
  }, [blog?.id]);

  const fetchEndpoints = async () => {
    if (!blog?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('blog_id', blog.id)
      .order('created_at', { ascending: false });
    setEndpoints((data as WebhookEndpoint[]) || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!blog?.id || !form.url || form.events.length === 0) {
      toast.error('URL e pelo menos um evento são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('webhook_endpoints').insert({
        blog_id: blog.id,
        url: form.url,
        description: form.description || null,
        secret: form.secret || null,
        events: form.events,
      });
      if (error) throw error;
      toast.success('Webhook adicionado');
      setShowAdd(false);
      setForm({ url: '', description: '', secret: '', events: [] });
      fetchEndpoints();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('webhook_endpoints').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir');
    } else {
      toast.success('Webhook removido');
      fetchEndpoints();
    }
  };

  const handleTest = async (endpoint: WebhookEndpoint) => {
    try {
      const { error } = await supabase.functions.invoke('dispatch-webhook', {
        body: {
          blog_id: blog?.id,
          event: 'article.published',
          data: { test: true, message: 'Webhook test from Omniseen' },
        },
      });
      if (error) throw error;
      toast.success('Teste enviado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao testar');
    }
  };

  const toggleEvent = (event: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Webhooks</h3>
          <p className="text-sm text-muted-foreground">
            Receba notificações em tempo real quando eventos acontecem no seu blog.
          </p>
        </div>
        <Button size="sm" className="gap-1" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {endpoints.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Webhook className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhum webhook configurado.</p>
            <p className="text-sm">Adicione um endpoint para receber notificações de eventos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {endpoints.map((ep) => (
            <Card key={ep.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm truncate">{ep.url}</p>
                    {ep.description && <p className="text-xs text-muted-foreground mt-1">{ep.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {ep.events.map((ev) => (
                        <Badge key={ev} variant="secondary" className="text-xs">{ev}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleTest(ep)} title="Testar">
                      <TestTube2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(ep.id)} title="Excluir">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Webhook</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>URL do Endpoint *</Label>
              <Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Minha integração" />
            </div>
            <div className="space-y-2">
              <Label>Secret (para assinatura HMAC)</Label>
              <Input value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} placeholder="whsec_..." />
            </div>
            <div className="space-y-2">
              <Label>Eventos *</Label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_EVENTS.map((ev) => (
                  <div key={ev.value} className="flex items-center gap-2">
                    <Checkbox
                      checked={form.events.includes(ev.value)}
                      onCheckedChange={() => toggleEvent(ev.value)}
                    />
                    <span className="text-sm">{ev.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
