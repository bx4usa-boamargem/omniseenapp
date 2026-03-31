import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Loader2, Copy, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenantContext } from '@/contexts/TenantContext';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  is_active: boolean;
}

export function ApiKeysTab() {
  const { currentTenant } = useTenantContext();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (currentTenant?.id) fetchKeys();
  }, [currentTenant?.id]);

  const fetchKeys = async () => {
    if (!currentTenant?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, last_used_at, created_at, is_active')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });
    setKeys((data as ApiKey[]) || []);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!currentTenant?.id || !name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setCreating(true);
    try {
      const rawKey = `omni_${crypto.randomUUID().replace(/-/g, '')}`;
      const keyPrefix = rawKey.slice(0, 12);
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey));
      const keyHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      const { error } = await supabase.from('api_keys').insert({
        tenant_id: currentTenant.id,
        name: name.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes: ['read', 'write'],
      });

      if (error) throw error;
      setShowNewKey(rawKey);
      setShowCreate(false);
      setName('');
      fetchKeys();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar chave');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', id);
    if (error) {
      toast.error('Erro ao revogar');
    } else {
      toast.success('Chave revogada');
      fetchKeys();
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Chave copiada!');
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
          <h3 className="text-lg font-medium">Chaves de API</h3>
          <p className="text-sm text-muted-foreground">
            Use chaves de API para acessar a API pública do Omniseen.
          </p>
        </div>
        <Button size="sm" className="gap-1" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Nova Chave
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Endpoint da API</CardTitle>
        </CardHeader>
        <CardContent>
          <code className="text-sm bg-muted px-3 py-2 rounded block">
            POST /functions/v1/public-api
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            Envie requests com header <code>x-api-key: sua_chave</code>
          </p>
        </CardContent>
      </Card>

      {keys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nenhuma chave criada.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <Card key={k.id} className={!k.is_active ? 'opacity-50' : ''}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{k.name}</p>
                    <p className="text-xs font-mono text-muted-foreground">{k.key_prefix}...</p>
                    <div className="flex gap-1 mt-1">
                      {k.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                      {!k.is_active && <Badge variant="destructive" className="text-xs">Revogada</Badge>}
                    </div>
                  </div>
                  {k.is_active && (
                    <Button variant="ghost" size="icon" onClick={() => handleRevoke(k.id)} title="Revogar">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar Chave de API</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Nome da Chave</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Integração Zapier" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!showNewKey} onOpenChange={() => setShowNewKey(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Chave Criada</DialogTitle></DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Copie esta chave agora. Ela não será exibida novamente.
            </p>
            <div className="flex gap-2">
              <Input value={showNewKey || ''} readOnly className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => copyKey(showNewKey || '')}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowNewKey(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
