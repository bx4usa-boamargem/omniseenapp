import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCMSIntegrations, type CMSPlatform } from "@/hooks/useCMSIntegrations";
import { supabase } from "@/integrations/supabase/client";
import { 
  Plus, Loader2, CheckCircle, XCircle, ExternalLink, Trash2, 
  RefreshCw, Globe, Key, User, AlertCircle, Unplug, FileText
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SectionHelper } from "./SectionHelper";

interface BlogDetectionStatus {
  hasBlog: boolean;
  postsEndpoint: boolean;
  categories: boolean;
  message: string;
}

interface CMSIntegrationsTabProps {
  blogId: string;
}

interface PlatformConfig {
  id: CMSPlatform;
  name: string;
  description: string;
  icon: string;
  fields: Array<{
    key: string;
    label: string;
    type: "text" | "password";
    placeholder: string;
    required: boolean;
    helpText?: string;
  }>;
  helpLink?: string;
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: "wordpress",
    name: "WordPress",
    description: "Publique automaticamente no seu site WordPress",
    icon: "🔵",
    fields: [
      { key: "siteUrl", label: "URL do Site", type: "text", placeholder: "https://meusite.com.br", required: true },
      { key: "username", label: "Usuário", type: "text", placeholder: "admin", required: true, helpText: "Usuário do WordPress com permissão de publicação" },
      { key: "apiKey", label: "Senha de Aplicativo", type: "password", placeholder: "xxxx xxxx xxxx xxxx", required: true, helpText: "Gere em Usuários → Perfil → Senhas de Aplicativo" },
    ],
    helpLink: "https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/",
  },
  {
    id: "wix",
    name: "Wix",
    description: "Conecte seu site Wix para publicação automática",
    icon: "🟡",
    fields: [
      { key: "siteUrl", label: "URL do Site", type: "text", placeholder: "https://meusite.wixsite.com/blog", required: true },
      { key: "apiKey", label: "API Key", type: "password", placeholder: "IST.xxx...", required: true, helpText: "Gere em Wix Dev Center → API Keys" },
    ],
    helpLink: "https://dev.wix.com/docs/rest/getting-started/api-keys",
  },
];

export function CMSIntegrationsTab({ blogId }: CMSIntegrationsTabProps) {
  const { 
    integrations, 
    loading, 
    testing, 
    addIntegration, 
    updateIntegration, 
    deleteIntegration, 
    testConnection 
  } = useCMSIntegrations(blogId);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<CMSPlatform | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [blogStatus, setBlogStatus] = useState<Record<string, BlogDetectionStatus>>({});
  const [detectingBlog, setDetectingBlog] = useState<string | null>(null);

  const handleAddIntegration = async () => {
    if (!selectedPlatform) return;
    
    const platform = PLATFORMS.find(p => p.id === selectedPlatform);
    if (!platform) return;
    
    // Validate required fields
    for (const field of platform.fields) {
      if (field.required && !formData[field.key]) {
        toast.error(`Campo obrigatório: ${field.label}`);
        return;
      }
    }
    
    setSaving(true);
    const result = await addIntegration(
      selectedPlatform,
      formData.siteUrl || "",
      {
        username: formData.username,
        apiKey: formData.apiKey,
        apiSecret: formData.apiSecret,
      }
    );
    
    if (result.success) {
      toast.success("Integração adicionada! Testando conexão...");
      setDialogOpen(false);
      setFormData({});
      setSelectedPlatform(null);
      
      // Auto-test connection
      if (result.integrationId) {
        const testResult = await testConnection(result.integrationId);
        if (testResult.success) {
          toast.success(testResult.message);
        } else {
          toast.error(testResult.message);
        }
      }
    } else {
      toast.error(result.message || "Erro ao adicionar integração");
    }
    setSaving(false);
  };

  const handleTestConnection = async (integrationId: string) => {
    const result = await testConnection(integrationId);
    if (result.success) {
      toast.success(result.message);
      
      // Auto-detect blog after successful connection test
      setDetectingBlog(integrationId);
      try {
        const { data: detectResult, error } = await supabase.functions.invoke("publish-to-cms", {
          body: { action: "detect-blog", integrationId },
        });
        
        if (!error && detectResult) {
          setBlogStatus(prev => ({ 
            ...prev, 
            [integrationId]: {
              hasBlog: detectResult.hasBlog,
              postsEndpoint: detectResult.postsEndpoint,
              categories: detectResult.categories,
              message: detectResult.message,
            }
          }));
          
          if (detectResult.hasBlog) {
            toast.success("Blog detectado e pronto para publicação!");
          } else {
            toast.warning("Blog não detectado. Verifique se o site possui funcionalidade de blog.");
          }
        }
      } catch (err) {
        console.error("Error detecting blog:", err);
      } finally {
        setDetectingBlog(null);
      }
    } else {
      toast.error(result.message);
    }
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    if (!confirm("Tem certeza que deseja remover esta integração?")) return;
    
    setDeleting(integrationId);
    await deleteIntegration(integrationId);
    setDeleting(null);
  };

  const handleToggleActive = async (integrationId: string, isActive: boolean) => {
    await updateIntegration(integrationId, { is_active: isActive });
  };

  const handleToggleAutoPublish = async (integrationId: string, autoPublish: boolean) => {
    await updateIntegration(integrationId, { auto_publish: autoPublish });
    toast.success(autoPublish ? "Publicação automática ativada" : "Publicação automática desativada");
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "connected":
        return <Badge variant="default" className="bg-success"><CheckCircle className="h-3 w-3 mr-1" /> Conectado</Badge>;
      case "error":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Erro</Badge>;
      default:
        return <Badge variant="outline">Não testado</Badge>;
    }
  };

  const getPlatformConfig = (platformId: string) => {
    return PLATFORMS.find(p => p.id === platformId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header with Helper */}
      <div className="flex items-start justify-between gap-4">
        <SectionHelper
          title="Integrações CMS"
          description="Conecte plataformas externas como WordPress ou Wix para publicar seus artigos automaticamente em múltiplos canais, economizando tempo e garantindo consistência."
          action="Adicione uma integração e configure as credenciais de acesso da plataforma de destino."
          warning="Esta é uma configuração avançada. Você precisará de acesso administrativo à plataforma de destino e conhecimento básico de APIs ou senhas de aplicativo."
        />
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Adicionar Integração CMS</DialogTitle>
              <DialogDescription>
                Conecte uma plataforma externa para publicar seus artigos automaticamente
              </DialogDescription>
            </DialogHeader>
            
            <Tabs value={selectedPlatform || undefined} onValueChange={(v) => setSelectedPlatform(v as CMSPlatform)}>
              <TabsList className="grid grid-cols-2 w-full">
                {PLATFORMS.map(platform => (
                  <TabsTrigger key={platform.id} value={platform.id} className="gap-2">
                    <span>{platform.icon}</span>
                    {platform.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {PLATFORMS.map(platform => (
                <TabsContent key={platform.id} value={platform.id} className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">{platform.description}</p>
                  
                  {platform.helpLink && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <a 
                          href={platform.helpLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="underline hover:text-primary"
                        >
                          Veja como obter suas credenciais →
                        </a>
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  {platform.fields.map(field => (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={field.key}>{field.label}</Label>
                      <Input
                        id={field.key}
                        type={field.type}
                        placeholder={field.placeholder}
                        value={formData[field.key] || ""}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      />
                      {field.helpText && (
                        <p className="text-xs text-muted-foreground">{field.helpText}</p>
                      )}
                    </div>
                  ))}
                  
                  <Button 
                    onClick={handleAddIntegration} 
                    disabled={saving} 
                    className="w-full"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Conectando...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Conectar {platform.name}
                      </>
                    )}
                  </Button>
                </TabsContent>
              ))}
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {integrations.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Nenhuma integração configurada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Conecte seu WordPress ou Wix para publicar artigos automaticamente
            </p>
            <Button onClick={() => setDialogOpen(true)} variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar Integração
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {integrations.map(integration => {
            const platform = getPlatformConfig(integration.platform);
            
            return (
              <Card key={integration.id} className={!integration.is_active ? "opacity-60" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{platform?.icon || "🔗"}</span>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                          {platform?.name || integration.platform}
                          {getStatusBadge(integration.last_sync_status)}
                          {blogStatus[integration.id] && (
                            <Badge 
                              variant={blogStatus[integration.id].hasBlog ? "default" : "secondary"}
                              className={blogStatus[integration.id].hasBlog 
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                                : ""}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              {blogStatus[integration.id].hasBlog ? "Blog Pronto" : "Sem Blog"}
                            </Badge>
                          )}
                          {detectingBlog === integration.id && (
                            <Badge variant="outline" className="animate-pulse">
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Detectando...
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <Globe className="h-3 w-3" />
                          {integration.site_url}
                        </CardDescription>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={integration.is_active}
                        onCheckedChange={(checked) => handleToggleActive(integration.id, checked)}
                      />
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {integration.last_sync_at && (
                    <p className="text-xs text-muted-foreground">
                      Última verificação: {formatDistanceToNow(new Date(integration.last_sync_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  )}
                  
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`auto-publish-${integration.id}`} className="text-sm cursor-pointer">
                        Publicar automaticamente ao publicar na Omniseen
                      </Label>
                    </div>
                    <Switch
                      id={`auto-publish-${integration.id}`}
                      checked={integration.auto_publish}
                      onCheckedChange={(checked) => handleToggleAutoPublish(integration.id, checked)}
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection(integration.id)}
                      disabled={testing === integration.id}
                    >
                      {testing === integration.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Testar Conexão
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a href={integration.site_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir Site
                      </a>
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteIntegration(integration.id)}
                      disabled={deleting === integration.id}
                      className="text-destructive hover:text-destructive ml-auto"
                    >
                      {deleting === integration.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
