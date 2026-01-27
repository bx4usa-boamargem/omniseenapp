import { ExternalLink, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connected: boolean;
  status?: 'active' | 'error' | 'pending';
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'wordpress',
    name: 'WordPress',
    description: 'Publique artigos diretamente no seu blog WordPress.',
    icon: '🔗',
    connected: false,
  },
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Integre seu e-commerce e gere conteúdo para produtos.',
    icon: '🛍️',
    connected: false,
  },
  {
    id: 'gsc',
    name: 'Google Search Console',
    description: 'Monitore seu desempenho de SEO e palavras-chave.',
    icon: '📊',
    connected: false,
  },
  {
    id: 'ga',
    name: 'Google Analytics',
    description: 'Acompanhe métricas de tráfego e conversão.',
    icon: '📈',
    connected: false,
  },
];

export function IntegrationsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Integrações</h3>
        <p className="text-sm text-muted-foreground">
          Conecte suas ferramentas favoritas para ampliar o poder da plataforma.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {INTEGRATIONS.map((integration) => (
          <Card key={integration.id} className="relative overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{integration.icon}</span>
                  <div>
                    <CardTitle className="text-base">{integration.name}</CardTitle>
                    {integration.connected && (
                      <Badge variant="secondary" className="mt-1 bg-green-500/10 text-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        Conectado
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                {integration.description}
              </CardDescription>
              <Button 
                variant={integration.connected ? "outline" : "default"} 
                size="sm"
                className="w-full"
              >
                {integration.connected ? (
                  'Gerenciar'
                ) : (
                  <>
                    Conectar
                    <ExternalLink className="h-3 w-3 ml-2" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* API Keys Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            Chaves de API
          </CardTitle>
          <CardDescription>
            Gerencie suas chaves de API para integrações customizadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Nenhuma chave de API configurada.
            </p>
            <Button variant="outline" size="sm">
              Gerar nova chave
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
