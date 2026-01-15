import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';

interface GSCSetupGuideProps {
  redirectUri?: string;
}

export function GSCSetupGuide({ redirectUri = 'https://omniseeblog.lovable.app/oauth/google/callback' }: GSCSetupGuideProps) {
  const [openSections, setOpenSections] = useState<string[]>(['consent']);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setOpenSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('Copiado!');
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyButton = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 shrink-0"
      onClick={() => copyToClipboard(text, field)}
    >
      {copiedField === field ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );

  const steps = [
    {
      id: 'consent',
      title: '1. Configurar Tela de Consentimento OAuth',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Acesse o Google Cloud Console e configure a tela de consentimento:
          </p>
          
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.open('https://console.cloud.google.com/apis/credentials/consent', '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Abrir OAuth Consent Screen
          </Button>

          <div className="space-y-3 mt-4">
            <h4 className="text-sm font-medium">Campos obrigatórios:</h4>
            
            <div className="space-y-2 text-sm">
              <div className="p-2 rounded bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nome do app:</span>
                  <div className="flex items-center gap-1">
                    <code className="px-1 py-0.5 bg-background rounded text-xs">OMNISEEN</code>
                    <CopyButton text="OMNISEEN" field="appName" />
                  </div>
                </div>
              </div>

              <div className="p-2 rounded bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Tipo de usuário:</span>
                  <span className="font-medium">Externo</span>
                </div>
              </div>

              <div className="p-2 rounded bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Homepage:</span>
                  <div className="flex items-center gap-1">
                    <code className="px-1 py-0.5 bg-background rounded text-xs">https://omniseen.app/</code>
                    <CopyButton text="https://omniseen.app/" field="homepage" />
                  </div>
                </div>
              </div>

              <div className="p-2 rounded bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Privacy Policy:</span>
                  <div className="flex items-center gap-1">
                    <code className="px-1 py-0.5 bg-background rounded text-xs">https://omniseen.app/privacy</code>
                    <CopyButton text="https://omniseen.app/privacy" field="privacy" />
                  </div>
                </div>
              </div>

              <div className="p-2 rounded bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Terms of Service:</span>
                  <div className="flex items-center gap-1">
                    <code className="px-1 py-0.5 bg-background rounded text-xs">https://omniseen.app/terms</code>
                    <CopyButton text="https://omniseen.app/terms" field="terms" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <h5 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2">
                ⚠️ Domínios Autorizados (obrigatório)
              </h5>
              <p className="text-xs text-muted-foreground mb-2">
                Adicione estes domínios em "Authorized domains":
              </p>
              <div className="space-y-1">
                <div className="flex items-center justify-between p-1.5 rounded bg-background">
                  <code className="text-xs">omniseen.app</code>
                  <CopyButton text="omniseen.app" field="domain1" />
                </div>
                <div className="flex items-center justify-between p-1.5 rounded bg-background">
                  <code className="text-xs">lovable.app</code>
                  <CopyButton text="lovable.app" field="domain2" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'credentials',
      title: '2. Criar Credenciais OAuth',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Crie as credenciais OAuth 2.0 para a aplicação web:
          </p>
          
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.open('https://console.cloud.google.com/apis/credentials', '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Abrir Credentials
          </Button>

          <div className="space-y-3 mt-4">
            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
              <li>Clique em "Create Credentials" → "OAuth client ID"</li>
              <li>Selecione "Web application"</li>
              <li>Defina o nome: <code className="px-1 py-0.5 bg-muted rounded text-xs">Omniseen Web</code></li>
            </ol>

            <div className="mt-4 p-3 rounded-lg bg-primary/10 border border-primary/20">
              <h5 className="text-sm font-medium text-primary mb-2">
                URI de Redirecionamento Autorizado
              </h5>
              <p className="text-xs text-muted-foreground mb-2">
                Cole esta URL exata no campo "Authorized redirect URIs":
              </p>
              <div className="flex items-center justify-between p-2 rounded bg-background">
                <code className="text-xs break-all">{redirectUri}</code>
                <CopyButton text={redirectUri} field="redirectUri" />
              </div>
            </div>

            <div className="mt-3 p-2 rounded bg-muted/50">
              <p className="text-xs text-muted-foreground">
                Após criar, copie o <strong>Client ID</strong> e <strong>Client Secret</strong> 
                e configure-os como secrets no projeto.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'api',
      title: '3. Ativar API do Search Console',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ative a Google Search Console API no seu projeto:
          </p>
          
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => window.open('https://console.cloud.google.com/apis/library/searchconsole.googleapis.com', '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Ativar Search Console API
          </Button>

          <div className="mt-3 p-2 rounded bg-muted/50">
            <p className="text-xs text-muted-foreground">
              Clique em "Enable" para ativar a API. Isso permite que a aplicação 
              acesse os dados do Google Search Console.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'publish',
      title: '4. Publicar App (Opcional)',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se o app estiver em modo "Testing", apenas usuários de teste terão acesso.
            Para permitir qualquer usuário:
          </p>
          
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Vá para OAuth Consent Screen</li>
            <li>Clique em "Publish App"</li>
            <li>Confirme a publicação</li>
          </ol>

          <div className="mt-3 p-2 rounded bg-blue-500/10 border border-blue-500/20">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              💡 Enquanto estiver em modo de teste, adicione seu email em 
              "Test users" para poder conectar.
            </p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-foreground">
        Guia de Configuração do Google Cloud Console
      </h3>
      
      <div className="space-y-2">
        {steps.map((step) => (
          <Collapsible
            key={step.id}
            open={openSections.includes(step.id)}
            onOpenChange={() => toggleSection(step.id)}
          >
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-left">
                <span className="text-sm font-medium text-foreground">{step.title}</span>
                {openSections.includes(step.id) ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-3 border-l-2 border-primary/20 ml-3 mt-1">
                {step.content}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
