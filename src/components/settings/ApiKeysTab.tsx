import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Key, Plus, Trash2, Copy, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
}

export function ApiKeysTab() {
  const [keys] = useState<ApiKey[]>([]);
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('Chave copiada!');
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/40 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Chaves de API</CardTitle>
                <CardDescription>
                  Gerencie as chaves de acesso à API do Omniseen
                </CardDescription>
              </div>
            </div>
            <Button className="gap-2" onClick={() => toast.info('Em breve: criação de chaves de API')}>
              <Plus className="h-4 w-4" />
              Nova Chave
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {keys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="p-4 rounded-full bg-muted/30 w-fit mx-auto mb-4">
                <Key className="h-10 w-10 opacity-40" />
              </div>
              <p className="font-medium text-foreground/80">Nenhuma chave criada</p>
              <p className="text-sm mt-1">Crie uma chave de API para integrar com sistemas externos.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map(apiKey => (
                <div key={apiKey.id} className="flex items-center justify-between p-4 rounded-xl border border-border/40 bg-muted/20 backdrop-blur-sm hover:bg-muted/30 transition-colors">
                  <div className="space-y-1.5">
                    <p className="font-medium text-sm">{apiKey.name}</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-background/60 px-2.5 py-1 rounded-md font-mono">
                        {showKey[apiKey.id] ? apiKey.key : '••••••••••••••••'}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setShowKey(prev => ({ ...prev, [apiKey.id]: !prev[apiKey.id] }))}
                      >
                        {showKey[apiKey.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopy(apiKey.key)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {apiKey.lastUsed && (
                      <p className="text-xs text-muted-foreground">Último uso: {apiKey.lastUsed}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
