import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Globe, CheckCircle2, XCircle, Loader2, Copy, ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";

interface Blog {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  domain_verified: boolean;
  domain_verification_token: string | null;
}

interface CustomDomainSettingsProps {
  blogId: string;
}

export const CustomDomainSettings = ({ blogId }: CustomDomainSettingsProps) => {
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [domain, setDomain] = useState("");

  useEffect(() => {
    fetchBlog();
  }, [blogId]);

  const fetchBlog = async () => {
    const { data, error } = await supabase
      .from("blogs")
      .select("id, name, slug, custom_domain, domain_verified, domain_verification_token")
      .eq("id", blogId)
      .single();

    if (error) {
      console.error("Error fetching blog:", error);
      setLoading(false);
      return;
    }

    setBlog(data);
    setDomain(data.custom_domain || "");
    setLoading(false);
  };

  const generateVerificationToken = () => {
    return `omniseen_verify_${Math.random().toString(36).substring(2, 15)}`;
  };

  const saveDomain = async () => {
    if (!blog) return;

    // Validate domain format
    const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    if (domain && !domainRegex.test(domain)) {
      toast.error("Formato de domínio inválido");
      return;
    }

    setSaving(true);

    const token = domain ? generateVerificationToken() : null;

    const { error } = await supabase
      .from("blogs")
      .update({
        custom_domain: domain || null,
        domain_verified: false,
        domain_verification_token: token,
      })
      .eq("id", blog.id);

    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar domínio");
      console.error("Error saving domain:", error);
      return;
    }

    toast.success("Domínio salvo com sucesso");
    fetchBlog();
  };

  const verifyDomain = async () => {
    if (!blog?.custom_domain) return;

    setVerifying(true);

    try {
      const { data, error } = await supabase.functions.invoke("verify-domain", {
        body: { blogId: blog.id },
      });

      if (error) throw error;

      if (data.verified) {
        toast.success("Domínio verificado com sucesso!");
        fetchBlog();
      } else {
        // Show detailed DNS status if available
        if (data.dnsStatus) {
          const { txt, a, cname, routingVerified } = data.dnsStatus;
          if (!txt.verified) {
            toast.error("Registro TXT não encontrado. Configure o registro de verificação.");
          } else if (!routingVerified) {
            const wrongIp = a.found.length > 0 && !a.verified;
            if (wrongIp) {
              toast.error(`DNS aponta para ${a.found.join(", ")} em vez de ${a.expected}. Corrija o registro A.`);
            } else {
              toast.error(`Configure o registro A para ${a.expected} ou CNAME para ${cname.expected}.`);
            }
          } else {
            toast.error(data.message || "Aguarde a propagação do DNS.");
          }
        } else {
          toast.error(data.message || "Domínio ainda não verificado. Verifique os registros DNS.");
        }
      }
    } catch (err) {
      console.error("Error verifying domain:", err);
      toast.error("Erro ao verificar domínio");
    } finally {
      setVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!blog) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Blog não encontrado
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-primary" />
          <CardTitle>Domínio Próprio</CardTitle>
        </div>
        <CardDescription>
          Configure um domínio personalizado para o seu blog (ex: blog.suaempresa.com)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Status:</span>
          {blog.domain_verified ? (
            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verificado
            </Badge>
          ) : blog.custom_domain ? (
            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
              <XCircle className="h-3 w-3 mr-1" />
              Pendente verificação
            </Badge>
          ) : (
            <Badge variant="secondary">
              Não configurado
            </Badge>
          )}
        </div>

        {/* Domain Input */}
        <div className="space-y-2">
          <Label htmlFor="domain">Seu domínio</Label>
          <div className="flex gap-2">
            <Input
              id="domain"
              placeholder="blog.suaempresa.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase().trim())}
              className="flex-1"
            />
            <Button onClick={saveDomain} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Use um subdomínio (ex: blog.suaempresa.com) ou domínio raiz (ex: meublog.com)
          </p>
        </div>

        {/* DNS Instructions */}
        {blog.custom_domain && !blog.domain_verified && (
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Configure os registros DNS no seu provedor de domínio para apontar para nossos servidores.
              </AlertDescription>
            </Alert>

            <div className="bg-muted/50 rounded-lg p-4 space-y-4">
              <h4 className="font-semibold text-sm">Registros DNS necessários:</h4>
              
            {/* A Record - Primary option */}
              <div className="space-y-2">
                <p className="text-sm font-medium">1. Registro A (recomendado)</p>
                <div className="bg-background rounded border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tipo:</span>
                    <code className="bg-muted px-2 py-0.5 rounded">A</code>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Nome:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-0.5 rounded">@</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard("@")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Valor:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-0.5 rounded font-bold text-primary">185.158.133.1</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard("185.158.133.1")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  ⚠️ Remova qualquer registro A existente antes de adicionar este.
                </p>
              </div>

              {/* CNAME Record - Alternative */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Ou: Registro CNAME (alternativa para subdomínios)</p>
                <div className="bg-background rounded border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tipo:</span>
                    <code className="bg-muted px-2 py-0.5 rounded">CNAME</code>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Nome:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-0.5 rounded">
                        {blog.custom_domain.includes(".") ? blog.custom_domain.split(".")[0] : "@"}
                      </code>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Valor:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-0.5 rounded">cname.lovableproject.com</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard("cname.lovableproject.com")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* TXT Record for verification */}
              <div className="space-y-2">
                <p className="text-sm font-medium">2. Registro TXT (verificação)</p>
                <div className="bg-background rounded border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tipo:</span>
                    <code className="bg-muted px-2 py-0.5 rounded">TXT</code>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Nome:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-0.5 rounded">_omniseen-verify</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard("_omniseen-verify")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Valor:</span>
                    <div className="flex items-center gap-2">
                      <code className="bg-muted px-2 py-0.5 rounded text-xs break-all">
                        {blog.domain_verification_token}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(blog.domain_verification_token || "")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                ⏱️ As alterações de DNS podem levar até 48 horas para propagar.
              </p>
            </div>

            <Button onClick={verifyDomain} disabled={verifying} className="w-full">
              {verifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verificar Domínio
                </>
              )}
            </Button>
          </div>
        )}

        {/* Verified domain info */}
        {blog.domain_verified && blog.custom_domain && (
          <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Seu blog está acessível em{" "}
              <a
                href={`https://${blog.custom_domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline inline-flex items-center gap-1"
              >
                {blog.custom_domain}
                <ExternalLink className="h-3 w-3" />
              </a>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
