import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Globe, 
  CheckCircle2, 
  Copy, 
  ExternalLink, 
  Loader2,
  AlertTriangle,
  Server,
  FolderOpen,
  Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DnsCheckPanel } from "@/components/domains/DnsCheckPanel";
import { SectionHelper } from "./SectionHelper";

interface DomainTabProps {
  blogId: string;
  blogSlug: string;
  customDomain: string;
  domainVerified: boolean;
  verificationToken: string;
  onCustomDomainChange: (value: string) => void;
  onDomainVerifiedChange: (value: boolean) => void;
  onVerificationTokenChange: (value: string) => void;
}

export function DomainTab({
  blogId,
  blogSlug,
  customDomain,
  domainVerified,
  verificationToken,
  onCustomDomainChange,
  onDomainVerifiedChange,
  onVerificationTokenChange,
}: DomainTabProps) {
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [integrationType, setIntegrationType] = useState<"subdomain" | "path">("subdomain");

  const defaultBlogUrl = `${window.location.origin}/blog/${blogSlug}`;

  const generateVerificationToken = () => {
    return `blogai-verify-${Math.random().toString(36).substring(2, 15)}`;
  };

  const saveDomain = async () => {
    if (!customDomain.trim()) {
      toast.error("Digite um domínio válido");
      return;
    }

    setSaving(true);
    try {
      const token = verificationToken || generateVerificationToken();
      
      const { error } = await supabase
        .from("blogs")
        .update({
          custom_domain: customDomain.toLowerCase().trim(),
          domain_verified: false,
          domain_verification_token: token,
          integration_type: integrationType,
        })
        .eq("id", blogId);

      if (error) throw error;

      onVerificationTokenChange(token);
      onDomainVerifiedChange(false);
      toast.success("Domínio salvo. Configure o DNS conforme as instruções.");
    } catch (error) {
      console.error("Error saving domain:", error);
      toast.error("Erro ao salvar domínio");
    } finally {
      setSaving(false);
    }
  };

  const verifyDomain = async () => {
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-domain", {
        body: { blogId },
      });

      if (error) throw error;

      if (data.verified) {
        onDomainVerifiedChange(true);
        toast.success("Domínio verificado com sucesso!");
      } else {
        toast.error(data.message || "Domínio ainda não verificado. Verifique as configurações de DNS.");
      }
    } catch (error) {
      console.error("Error verifying domain:", error);
      toast.error("Erro ao verificar domínio");
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado!");
  };

  const removeDomain = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("blogs")
        .update({
          custom_domain: null,
          domain_verified: false,
          domain_verification_token: null,
          integration_type: "subdomain",
        })
        .eq("id", blogId);

      if (error) throw error;

      onCustomDomainChange("");
      onDomainVerifiedChange(false);
      onVerificationTokenChange("");
      toast.success("Domínio removido");
    } catch (error) {
      console.error("Error removing domain:", error);
      toast.error("Erro ao remover domínio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Current URL */}
      <div className="space-y-4">
        <SectionHelper
          title="URL Padrão do Blog"
          description="Esta é a URL gratuita do seu blog, hospedada na plataforma. Você pode usar esta URL imediatamente ou configurar um domínio personalizado para maior profissionalismo."
        />
        <div className="flex gap-2">
          <Input value={defaultBlogUrl} readOnly className="flex-1 bg-muted" />
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.open(defaultBlogUrl, "_blank")}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Integration Type Selection */}
      <div className="space-y-4">
        <SectionHelper
          title="Tipo de Integração"
          description="Escolha como seu blog será acessado pelos visitantes: em um subdomínio exclusivo (blog.seusite.com) ou integrado ao seu site existente (seusite.com/blog)."
          action="Selecione o tipo de integração que melhor se adapta à estrutura atual do seu site."
        />

        <RadioGroup
          value={integrationType}
          onValueChange={(value) => setIntegrationType(value as "subdomain" | "path")}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          disabled={domainVerified}
        >
          <div className={`relative flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${integrationType === "subdomain" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
            <RadioGroupItem value="subdomain" id="subdomain" className="mt-1" />
            <label htmlFor="subdomain" className="ml-3 cursor-pointer flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Server className="h-4 w-4 text-primary" />
                <span className="font-medium">Subdomínio</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Seu blog em um subdomínio exclusivo (ex: blog.seusite.com)
              </p>
            </label>
          </div>

          <div className={`relative flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${integrationType === "path" ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}>
            <RadioGroupItem value="path" id="path" className="mt-1" />
            <label htmlFor="path" className="ml-3 cursor-pointer flex-1">
              <div className="flex items-center gap-2 mb-1">
                <FolderOpen className="h-4 w-4 text-primary" />
                <span className="font-medium">Caminho /blog</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Integre com seu site existente (ex: seusite.com/blog)
              </p>
            </label>
          </div>
        </RadioGroup>
      </div>

      {/* Custom Domain */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <SectionHelper
            title="Domínio Personalizado"
            description="Um domínio próprio transmite mais profissionalismo e melhora o SEO do seu blog, consolidando a autoridade do seu site."
            action="Digite seu domínio e siga as instruções para configurar os registros DNS."
          />
          {domainVerified && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verificado
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <Label>Seu domínio</Label>
          <div className="flex gap-2">
            <Input
              value={customDomain}
              onChange={(e) => onCustomDomainChange(e.target.value)}
              placeholder={integrationType === "subdomain" ? "blog.seusite.com" : "seusite.com"}
              disabled={domainVerified}
            />
            {!domainVerified ? (
              <Button onClick={saveDomain} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            ) : (
              <Button variant="outline" onClick={removeDomain} disabled={saving}>
                Remover
              </Button>
            )}
          </div>
        </div>

        {/* DNS Instructions for Subdomain */}
        {customDomain && !domainVerified && verificationToken && integrationType === "subdomain" && (
          <div className="space-y-4">
            {/* DNS Check Panel */}
            <DnsCheckPanel 
              blogId={blogId}
              customDomain={customDomain}
            />

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="space-y-4">
                <p className="font-medium">Configure os registros DNS do seu domínio:</p>
                
                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium mb-2">1. Registro CNAME</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Tipo:</span>
                        <p className="font-mono">CNAME</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Nome:</span>
                        <p className="font-mono">{customDomain.split('.')[0]}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Valor:</span>
                        <div className="flex items-center gap-1">
                          <p className="font-mono truncate">cname.lovableproject.com</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => copyToClipboard("cname.lovableproject.com")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <p className="font-medium mb-2">2. Registro TXT (Verificação)</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      <strong>Importante:</strong> No campo "Nome" ou "Host", digite apenas <code className="bg-background px-1 rounded">_omniseen-verify</code> (sem o domínio).
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Tipo:</span>
                        <p className="font-mono">TXT</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Nome:</span>
                        <div className="flex items-center gap-1">
                          <p className="font-mono">_omniseen-verify</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => copyToClipboard("_omniseen-verify")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Valor:</span>
                        <div className="flex items-center gap-1">
                          <p className="font-mono truncate">{verificationToken}</p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5"
                            onClick={() => copyToClipboard(verificationToken)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Button onClick={verifyDomain} disabled={verifying} className="w-full">
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    "Verificar Domínio"
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* Path Integration Instructions */}
        {customDomain && !domainVerified && verificationToken && integrationType === "path" && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="space-y-4">
              <p className="font-medium">Configure o redirecionamento no seu servidor:</p>
              
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  Para integrar o blog no caminho /blog do seu site, configure um proxy reverso no seu servidor.
                </p>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium mb-2">Nginx</p>
                  <pre className="text-xs overflow-x-auto p-2 bg-background rounded">
{`location /blog {
    proxy_pass ${defaultBlogUrl};
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}`}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => copyToClipboard(`location /blog {\n    proxy_pass ${defaultBlogUrl};\n    proxy_set_header Host $host;\n    proxy_set_header X-Real-IP $remote_addr;\n}`)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar
                  </Button>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium mb-2">Apache (.htaccess)</p>
                  <pre className="text-xs overflow-x-auto p-2 bg-background rounded">
{`RewriteEngine On
RewriteRule ^blog/(.*)$ ${defaultBlogUrl}/$1 [P,L]`}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => copyToClipboard(`RewriteEngine On\nRewriteRule ^blog/(.*)$ ${defaultBlogUrl}/$1 [P,L]`)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar
                  </Button>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium mb-2">Cloudflare Workers</p>
                  <pre className="text-xs overflow-x-auto p-2 bg-background rounded">
{`addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/blog')) {
    url.hostname = '${window.location.hostname}';
    event.respondWith(fetch(url, event.request));
  }
});`}
                  </pre>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => copyToClipboard(`addEventListener('fetch', event => {\n  const url = new URL(event.request.url);\n  if (url.pathname.startsWith('/blog')) {\n    url.hostname = '${window.location.hostname}';\n    event.respondWith(fetch(url, event.request));\n  }\n});`)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar
                  </Button>
                </div>
              </div>

              <Button onClick={verifyDomain} disabled={verifying} className="w-full">
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Verificar Configuração"
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Success Message */}
        {domainVerified && customDomain && (
          <Alert className="border-green-500/50 bg-green-50 dark:bg-green-900/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <p className="font-medium text-green-700 dark:text-green-400">
                {integrationType === "subdomain" ? "Domínio" : "Integração"} configurado(a) com sucesso!
              </p>
              <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                Seu blog está disponível em:{" "}
                <a
                  href={integrationType === "subdomain" ? `https://${customDomain}` : `https://${customDomain}/blog`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  {integrationType === "subdomain" ? `https://${customDomain}` : `https://${customDomain}/blog`}
                </a>
              </p>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
