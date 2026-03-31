import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="h-5 w-5 text-primary" />
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
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma chave criada</p>
              <p className="text-sm">Crie uma chave de API para integrar com sistemas externos.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map(apiKey => (
                <div key={apiKey.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{apiKey.name}</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs bg-muted px-2 py-0.5 rounded">
                        {showKey[apiKey.id] ? apiKey.key : '••••••••••••••••'}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setShowKey(prev => ({ ...prev, [apiKey.id]: !prev[apiKey.id] }))}
                      >
                        {showKey[apiKey.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleCopy(apiKey.key)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    {apiKey.lastUsed && (
                      <p className="text-xs text-muted-foreground">Último uso: {apiKey.lastUsed}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
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
