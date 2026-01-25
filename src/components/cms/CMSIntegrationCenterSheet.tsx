import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCMSIntegrations, type CMSPlatform, type CMSIntegration } from "@/hooks/useCMSIntegrations";
import { useTenantDomains, TenantDomain } from "@/hooks/useTenantDomains";
import { DomainPublishingSelector } from "./DomainPublishingSelector";
import { DomainPublishedCard } from "./DomainPublishedCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  Globe,
  ExternalLink,
  RefreshCw,
  Unplug,
  Trash2,
  AlertCircle,
  Send,
  Pencil,
  PlugZap,
} from "lucide-react";

interface CMSIntegrationCenterSheetProps {
  blogId: string;
  articleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublishSuccess?: (url: string) => void;
}

// Extended platform type to include domain publishing
type ExtendedPlatform = CMSPlatform | "domain";

interface PlatformConfig {
  id: ExtendedPlatform;
  name: string;
  description: string;
  icon: string;
  authType: "application-password" | "oauth" | "api-key" | "domain";
  fields: Array<{
    key: string;
    label: string;
    type: "text" | "password";
    placeholder: string;
    required: boolean;
    helpText?: string;
  }>;
  helpLink?: string;
  oauthButton?: boolean;
  domainSelector?: boolean; // For domain publishing
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: "wordpress",
    name: "WordPress.org",
    description: "Para sites WordPress auto-hospedados",
    icon: "🔵",
    authType: "application-password",
    fields: [
      { key: "siteUrl", label: "URL do Site", type: "text", placeholder: "https://meusite.com.br", required: true },
      { key: "username", label: "Usuário", type: "text", placeholder: "admin", required: true, helpText: "Usuário do WordPress com permissão de publicação" },
      { key: "apiKey", label: "Senha de Aplicativo", type: "password", placeholder: "xxxx xxxx xxxx xxxx", required: true, helpText: "Gere em Usuários → Perfil → Senhas de Aplicativo" },
    ],
    helpLink: "https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/",
  },
  {
    id: "wordpress-com",
    name: "WordPress.com",
    description: "Para sites hospedados no WordPress.com",
    icon: "🌐",
    authType: "oauth",
    oauthButton: true,
    fields: [],
    helpLink: "https://wordpress.com/support/",
  },
  {
    id: "wix",
    name: "Wix",
    description: "Conecte seu site Wix para publicação automática",
    icon: "🟡",
    authType: "api-key",
    fields: [
      { key: "siteUrl", label: "URL do Site", type: "text", placeholder: "https://meusite.wixsite.com/blog", required: true },
      { key: "apiKey", label: "API Key", type: "password", placeholder: "IST.xxx...", required: true, helpText: "Gere em Wix Dev Center → API Keys" },
    ],
    helpLink: "https://dev.wix.com/docs/rest/getting-started/api-keys",
  },
  {
    id: "domain",
    name: "Domínio Próprio",
    description: "Publique diretamente no seu subdomínio OmniSeen ou domínio customizado",
    icon: "🌍",
    authType: "domain",
    fields: [],
    domainSelector: true,
  },
];

// Article publication info type
interface ArticlePublicationInfo {
  publication_target: string | null;
  publication_url: string | null;
  status: string | null;
  slug: string;
}

export function CMSIntegrationCenterSheet({
  blogId,
  articleId,
  open,
  onOpenChange,
  onPublishSuccess,
}: CMSIntegrationCenterSheetProps) {
  const {
    integrations,
    loading,
    testing,
    addIntegration,
    updateIntegration,
    deleteIntegration,
    testConnection,
    publishArticle,
    initiateWordPressComOAuth,
    refetch, // CRITICAL: Force state sync after operations
  } = useCMSIntegrations(blogId);

  // Domain publishing hook
  const { 
    domains, 
    loading: domainsLoading, 
    getActiveDomains, 
    getPrimaryDomain,
    getCanonicalUrl 
  } = useTenantDomains({ blogId, onlyActive: true });

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<CMSIntegration | null>(null);
  const [errorDetailOpen, setErrorDetailOpen] = useState(false);
  const [lastErrorDetails, setLastErrorDetails] = useState<{ message: string; chain?: string[] } | null>(null);
  
  // Form states
  const [selectedPlatform, setSelectedPlatform] = useState<ExtendedPlatform | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  
  // Domain publishing states
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [selectedDomainInfo, setSelectedDomainInfo] = useState<TenantDomain | null>(null);
  const [publishingToDomain, setPublishingToDomain] = useState(false);
  
  // Article publication state
  const [articlePublicationInfo, setArticlePublicationInfo] = useState<ArticlePublicationInfo | null>(null);
  const [loadingArticleInfo, setLoadingArticleInfo] = useState(false);
  const [isEditingDomain, setIsEditingDomain] = useState(false);
  
  // Action states
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState(false);

  // Fetch article publication info
  const fetchArticlePublicationInfo = useCallback(async () => {
    if (!articleId) return;
    
    setLoadingArticleInfo(true);
    try {
      const { data, error } = await supabase
        .from("articles")
        .select("publication_target, publication_url, status, slug")
        .eq("id", articleId)
        .single();

      if (error) {
        console.error("[CMSIntegrationCenterSheet] Error fetching article info:", error);
        return;
      }

      setArticlePublicationInfo(data);
    } catch (err) {
      console.error("[CMSIntegrationCenterSheet] Error:", err);
    } finally {
      setLoadingArticleInfo(false);
    }
  }, [articleId]);

  // Fetch article info when sheet opens
  useEffect(() => {
    if (open && articleId) {
      fetchArticlePublicationInfo();
      setIsEditingDomain(false);
    }
  }, [open, articleId, fetchArticlePublicationInfo]);

  // Check if article is published to a domain
  const isPublishedToDomain = articlePublicationInfo?.publication_target === "domain" && 
                               articlePublicationInfo?.publication_url;

  // CORRECTION #1: Reset form state when add dialog opens to prevent dirty state
  useEffect(() => {
    if (addDialogOpen) {
      setSelectedPlatform(null);
      setFormData({});
      setSelectedDomain(null);
      setSelectedDomainInfo(null);
    }
  }, [addDialogOpen]);

  // Get platform config
  const getPlatformConfig = (platformId: string) => {
    return PLATFORMS.find((p) => p.id === platformId);
  };

  // Get status badge
  const getStatusBadge = (integration: CMSIntegration) => {
    if (!integration.is_active) {
      return (
        <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400">
          <Unplug className="h-3 w-3 mr-1" />
          Desconectado
        </Badge>
      );
    }
    switch (integration.last_sync_status) {
      case "connected":
        return (
          <Badge variant="default" className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Conectado
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            <AlertCircle className="h-3 w-3 mr-1" />
            Não testado
          </Badge>
        );
    }
  };

  // Check if can publish directly
  const activeIntegrations = integrations.filter((i) => i.is_active);
  const testedIntegrations = activeIntegrations.filter((i) => i.last_sync_status === "connected");
  const canPublishDirectly = testedIntegrations.length === 1;
  const publishableIntegration = canPublishDirectly ? testedIntegrations[0] : null;

  // Handle WordPress.com OAuth
  const handleWordPressComOAuth = async () => {
    setOauthLoading(true);
    try {
      const result = await initiateWordPressComOAuth();
      if (result.success && result.authUrl) {
        window.open(result.authUrl, "_blank", "width=600,height=700");
        toast.info("Complete a autorização na janela do WordPress.com");
        setAddDialogOpen(false);
      } else {
        toast.error(result.message || "Erro ao iniciar autenticação");
      }
    } catch (err) {
      console.error("OAuth error:", err);
      toast.error("Erro ao iniciar autenticação");
    } finally {
      setOauthLoading(false);
    }
  };

  // Handle add integration (for CMS platforms, not domain)
  const handleAddIntegration = async () => {
    if (!selectedPlatform || selectedPlatform === "domain") return;

    const platform = PLATFORMS.find((p) => p.id === selectedPlatform);
    if (!platform) return;

    for (const field of platform.fields) {
      if (field.required && !formData[field.key]) {
        toast.error(`Campo obrigatório: ${field.label}`);
        return;
      }
    }

    setSaving(true);
    // Cast to CMSPlatform since we already excluded "domain"
    const result = await addIntegration(selectedPlatform as CMSPlatform, formData.siteUrl || "", {
      username: formData.username,
      apiKey: formData.apiKey,
      apiSecret: formData.apiSecret,
    });

    if (result.success) {
      toast.success("Integração adicionada! Testando conexão...");
      setAddDialogOpen(false);
      setFormData({});
      setSelectedPlatform(null);

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

  // Handle domain selection for native publishing
  const handleDomainSelect = (domain: string, domainInfo: TenantDomain) => {
    setSelectedDomain(domain);
    setSelectedDomainInfo(domainInfo);
  };

  // Handle publish to native domain (Automaticles model)
  const handlePublishToDomain = async () => {
    if (!selectedDomain || !articleId) return;

    setPublishingToDomain(true);
    try {
      // Use existing slug from article info or fetch it
      const articleSlug = articlePublicationInfo?.slug;
      if (!articleSlug) {
        const { data: article, error: articleError } = await supabase
          .from("articles")
          .select("slug, title")
          .eq("id", articleId)
          .single();

        if (articleError || !article) {
          toast.error("Artigo não encontrado");
          return;
        }
      }

      const canonicalUrl = `https://${selectedDomain}/${articleSlug || articlePublicationInfo?.slug}`;

      // Update article to published status with domain target
      const { error: updateError } = await supabase
        .from("articles")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          publication_target: "domain",
          publication_url: canonicalUrl,
        })
        .eq("id", articleId);

      if (updateError) {
        console.error("Publish to domain error:", updateError);
        toast.error("Erro ao publicar no domínio");
        return;
      }

      toast.success("Publicado no domínio!", {
        description: `Disponível em ${selectedDomain}`,
        action: {
          label: "Abrir",
          onClick: () => window.open(canonicalUrl, "_blank"),
        },
      });

      onPublishSuccess?.(canonicalUrl);
      await fetchArticlePublicationInfo(); // Refresh article info
      setIsEditingDomain(false);
      setAddDialogOpen(false);
      onOpenChange(false);
    } catch (err) {
      console.error("Publish to domain error:", err);
      toast.error("Erro ao publicar no domínio");
    } finally {
      setPublishingToDomain(false);
    }
  };

  // Handle change domain (for already published articles)
  const handleChangeDomain = async () => {
    if (!selectedDomain || !articleId || !articlePublicationInfo?.slug) return;

    setPublishingToDomain(true);
    try {
      const newCanonicalUrl = `https://${selectedDomain}/${articlePublicationInfo.slug}`;

      const { error: updateError } = await supabase
        .from("articles")
        .update({
          publication_url: newCanonicalUrl,
        })
        .eq("id", articleId);

      if (updateError) {
        console.error("Change domain error:", updateError);
        toast.error("Erro ao trocar domínio");
        return;
      }

      toast.success("Domínio atualizado!", {
        description: `Agora disponível em ${selectedDomain}`,
        action: {
          label: "Abrir",
          onClick: () => window.open(newCanonicalUrl, "_blank"),
        },
      });

      await fetchArticlePublicationInfo(); // Refresh article info
      setIsEditingDomain(false);
      setSelectedDomain(null);
      setSelectedDomainInfo(null);
    } catch (err) {
      console.error("Change domain error:", err);
      toast.error("Erro ao trocar domínio");
    } finally {
      setPublishingToDomain(false);
    }
  };

  // Handle disconnect from domain
  const handleDisconnectFromDomain = async () => {
    if (!articleId) return;

    try {
      const { error: updateError } = await supabase
        .from("articles")
        .update({
          publication_target: null,
          publication_url: null,
          status: "draft",
          published_at: null,
        })
        .eq("id", articleId);

      if (updateError) {
        console.error("Disconnect from domain error:", updateError);
        toast.error("Erro ao desconectar do domínio");
        return;
      }

      toast.success("Artigo desconectado do domínio", {
        description: "O artigo voltou para rascunho e pode ser republicado.",
      });

      await fetchArticlePublicationInfo(); // Refresh article info
      setIsEditingDomain(false);
    } catch (err) {
      console.error("Disconnect from domain error:", err);
      toast.error("Erro ao desconectar do domínio");
    }
  };

  // Handle edit/reconnect
  const handleEditIntegration = async () => {
    if (!editingIntegration) return;

    setSaving(true);
    const updates: Record<string, unknown> = { is_active: true };
    if (formData.siteUrl) updates.site_url = formData.siteUrl;
    if (formData.username) updates.username = formData.username;
    if (formData.apiKey) updates.api_key = formData.apiKey;

    const success = await updateIntegration(editingIntegration.id, updates as Parameters<typeof updateIntegration>[1]);

    if (success) {
      await refetch(); // Force immediate state sync
      toast.success("Credenciais atualizadas! Testando conexão...");
      const testResult = await testConnection(editingIntegration.id);
      if (testResult.success) {
        await refetch(); // Sync after test
        toast.success(testResult.message);
      } else {
        await refetch(); // Sync even on error to show correct status
        toast.error(testResult.message);
      }
      setEditDialogOpen(false);
      setEditingIntegration(null);
      setFormData({});
    } else {
      toast.error("Erro ao atualizar integração");
    }
    setSaving(false);
  };

  // Handle test connection - with state sync
  const handleTestConnection = async (integrationId: string) => {
    const result = await testConnection(integrationId);
    await refetch(); // MANDATORY: Sync state after test
    
    if (result.success) {
      toast.success(result.message);
      setLastErrorDetails(null);
    } else {
      // Check for redirect loop errors
      if (result.code === "REDIRECT_LOOP" || result.code === "REDIRECT_ERROR") {
        setLastErrorDetails({ message: result.message, chain: result.chain });
        toast.error("Erro de redirect detectado", {
          description: "Clique em 'Ver Detalhes' para diagnóstico completo",
          duration: 8000,
        });
      } else {
        toast.error(result.message);
        setLastErrorDetails({ message: result.message });
      }
    }
  };

  // Handle disconnect - CRITICAL: Force refetch to prevent ghost states
  const handleDisconnect = async (integrationId: string) => {
    setDisconnecting(integrationId);
    const success = await updateIntegration(integrationId, { is_active: false });
    if (success) {
      await refetch(); // MANDATORY: Sync state immediately
      toast.success("Integração desconectada", {
        description: "Não será mais usada para publicação. Reconecte quando desejar."
      });
    }
    setDisconnecting(null);
  };

  // Handle delete - CRITICAL: Force refetch after deletion
  const handleDelete = async (integrationId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta integração permanentemente?")) return;
    setDeleting(integrationId);
    const deleted = await deleteIntegration(integrationId);
    if (deleted) {
      await refetch(); // MANDATORY: Remove from state immediately
    }
    setDeleting(null);
  };

  // Handle publish
  const handlePublish = async () => {
    if (!publishableIntegration) return;

    setPublishing(true);
    try {
      const result = await publishArticle(publishableIntegration.id, articleId);

      if (result.success) {
        toast.success("Publicado com sucesso!", {
          description: result.externalUrl ? `Artigo disponível no ${getPlatformConfig(publishableIntegration.platform)?.name}` : undefined,
          action: result.externalUrl
            ? {
                label: "Abrir",
                onClick: () => window.open(result.externalUrl, "_blank"),
              }
            : undefined,
        });
        if (result.externalUrl) {
          onPublishSuccess?.(result.externalUrl);
          window.open(result.externalUrl, "_blank");
        }
        onOpenChange(false);
      } else {
        toast.error(`Erro ao publicar: ${result.message || "Erro desconhecido"}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro inesperado ao publicar";
      console.error("Publish error:", e);
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  };

  // Open edit dialog for reconnection
  const openEditDialog = (integration: CMSIntegration) => {
    setEditingIntegration(integration);
    setFormData({
      siteUrl: integration.site_url,
      username: integration.username || "",
      apiKey: "",
    });
    setEditDialogOpen(true);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[420px] sm:w-[540px] p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Central de Publicação
          </SheetTitle>
          <SheetDescription>
            Gerencie suas integrações CMS e publique seu artigo
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
            {/* Error Details Alert */}
            {lastErrorDetails && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="space-y-2">
                  <p className="font-medium">{lastErrorDetails.message}</p>
                  {lastErrorDetails.chain && lastErrorDetails.chain.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium mb-1">Cadeia de redirects:</p>
                      <div className="bg-destructive/10 p-2 rounded text-xs font-mono overflow-x-auto">
                        {lastErrorDetails.chain.map((url, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            {idx > 0 && <span className="text-destructive">↓</span>}
                            <span className="break-all">{url}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs mt-2 text-muted-foreground">
                        Corrija a configuração de URL canônica, SSL ou www no WordPress/servidor.
                      </p>
                    </div>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setLastErrorDetails(null)}
                  >
                    Dispensar
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : integrations.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">Nenhuma integração configurada</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Conecte seu WordPress ou Wix para publicar artigos automaticamente
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {integrations.map((integration) => {
                  const platform = getPlatformConfig(integration.platform);
                  const isTesting = testing === integration.id;
                  const isDeleting = deleting === integration.id;
                  const isDisconnecting = disconnecting === integration.id;

                  return (
                    <Card
                      key={integration.id}
                      className={!integration.is_active ? "opacity-70 border-dashed" : ""}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{platform?.icon || "🔗"}</span>
                            <div>
                              <CardTitle className="text-sm font-medium">
                                {platform?.name || integration.platform}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-1 text-xs">
                                <Globe className="h-3 w-3" />
                                {integration.site_url}
                              </CardDescription>
                            </div>
                          </div>
                          {getStatusBadge(integration)}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-2 space-y-3">
                        {integration.last_sync_at && (
                          <p className="text-xs text-muted-foreground">
                            Última verificação:{" "}
                            {formatDistanceToNow(new Date(integration.last_sync_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Test Connection */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestConnection(integration.id)}
                            disabled={isTesting}
                            className="gap-1"
                          >
                            {isTesting ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3 w-3" />
                            )}
                            Testar
                          </Button>

                          {/* Disconnect (only if active) */}
                          {integration.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDisconnect(integration.id)}
                              disabled={isDisconnecting}
                              className="gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
                            >
                              {isDisconnecting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Unplug className="h-3 w-3" />
                              )}
                              Desconectar
                            </Button>
                          )}

                          {/* Reconnect (only if inactive) */}
                          {!integration.is_active && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(integration)}
                              className="gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                            >
                              <PlugZap className="h-3 w-3" />
                              Reconectar
                            </Button>
                          )}

                          {/* Edit */}
                          {integration.is_active && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(integration)}
                              className="gap-1"
                            >
                              <Pencil className="h-3 w-3" />
                              Editar
                            </Button>
                          )}

                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(integration.id)}
                            disabled={isDeleting}
                            className="text-destructive hover:text-destructive ml-auto"
                            title="Excluir permanentemente"
                          >
                            {isDeleting ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Add Integration Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full gap-2 mt-4">
                  <Plus className="h-4 w-4" />
                  Adicionar Integração
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Adicionar Integração CMS</DialogTitle>
                  <DialogDescription>
                    Conecte uma plataforma externa para publicar seus artigos automaticamente
                  </DialogDescription>
                </DialogHeader>

                <Tabs
                  value={selectedPlatform || undefined}
                  onValueChange={(v) => setSelectedPlatform(v as ExtendedPlatform)}
                >
                  <TabsList className="grid grid-cols-4 w-full">
                    {PLATFORMS.map((platform) => (
                      <TabsTrigger key={platform.id} value={platform.id} className="gap-1 text-xs">
                        <span>{platform.icon}</span>
                        <span className="hidden sm:inline">{platform.name}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {PLATFORMS.map((platform) => (
                    <TabsContent key={platform.id} value={platform.id} className="space-y-4 mt-4">
                      <p className="text-sm text-muted-foreground">{platform.description}</p>

                      {/* Domain Publishing Option - Automaticles Model */}
                      {platform.domainSelector ? (
                        <div className="space-y-4">
                          {/* Show published card if already published to domain */}
                          {isPublishedToDomain && !isEditingDomain ? (
                            <>
                              <DomainPublishedCard
                                publicationUrl={articlePublicationInfo.publication_url!}
                                onEdit={() => setIsEditingDomain(true)}
                                onDisconnect={handleDisconnectFromDomain}
                              />
                            </>
                          ) : (
                            <>
                              {/* Show "back" button if editing existing publication */}
                              {isEditingDomain && isPublishedToDomain && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setIsEditingDomain(false);
                                    setSelectedDomain(null);
                                    setSelectedDomainInfo(null);
                                  }}
                                  className="mb-2"
                                >
                                  ← Voltar
                                </Button>
                              )}

                              <Alert className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800">
                                <Globe className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <AlertDescription className="text-sm space-y-2">
                                  <p className="font-medium text-green-900 dark:text-green-100">
                                    {isEditingDomain ? "Selecione o Novo Domínio" : "Publicação Direta (Sem API)"}
                                  </p>
                                  {!isEditingDomain && (
                                    <ul className="text-xs text-green-800 dark:text-green-200 space-y-1 ml-4 list-disc">
                                      <li>Sem credenciais, sem OAuth, sem erros de API</li>
                                      <li>Artigo disponível instantaneamente no seu domínio</li>
                                      <li>Controle total sobre o conteúdo</li>
                                    </ul>
                                  )}
                                </AlertDescription>
                              </Alert>

                              <DomainPublishingSelector
                                blogId={blogId}
                                selectedDomain={selectedDomain}
                                onSelect={handleDomainSelect}
                              />

                              {selectedDomain && (
                                <Button
                                  onClick={isEditingDomain ? handleChangeDomain : handlePublishToDomain}
                                  disabled={publishingToDomain}
                                  className="w-full gap-2 bg-green-600 hover:bg-green-700"
                                  size="lg"
                                >
                                  {publishingToDomain ? (
                                    <>
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      {isEditingDomain ? "Atualizando..." : "Publicando..."}
                                    </>
                                  ) : (
                                    <>
                                      <Send className="h-4 w-4" />
                                      {isEditingDomain ? "Confirmar Novo Domínio" : "Publicar no Domínio"}
                                    </>
                                  )}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      ) : platform.oauthButton ? (
                        /* WordPress.com OAuth with explanation BEFORE action */
                        <div className="space-y-4">
                          {/* Explanation of OAuth flow - user must consciously click */}
                          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
                            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            <AlertDescription className="text-sm space-y-2">
                              <p className="font-medium text-blue-900 dark:text-blue-100">
                                Autenticação Segura WordPress.com
                              </p>
                              <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 ml-4 list-disc">
                                <li>Você será redirecionado para WordPress.com</li>
                                <li>Autorize o OmniSeen a publicar em seu site</li>
                                <li>Após autorizar, a conexão será salva automaticamente</li>
                              </ul>
                            </AlertDescription>
                          </Alert>
                          
                          {/* OAuth Button - conscious action */}
                          <Button
                            onClick={handleWordPressComOAuth}
                            disabled={oauthLoading}
                            className="w-full gap-2"
                            size="lg"
                          >
                            {oauthLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Abrindo WordPress.com...
                              </>
                            ) : (
                              <>
                                <ExternalLink className="h-4 w-4" />
                                Conectar com WordPress.com
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        /* Credential platforms - Fields FIRST, help link AFTER */
                        <div className="space-y-4">
                          {/* Fields in highlighted box - PRIMARY ACTION */}
                          <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                            {platform.fields.map((field) => (
                              <div key={field.key} className="space-y-2">
                                <Label htmlFor={field.key} className="font-semibold">{field.label}</Label>
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

                            <Button onClick={handleAddIntegration} disabled={saving} className="w-full" size="lg">
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
                          </div>

                          {/* Help link - SECONDARY, after fields */}
                          {platform.helpLink && (
                            <div className="text-center">
                              <a
                                href={platform.helpLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-muted-foreground hover:text-primary underline inline-flex items-center gap-1"
                              >
                                <AlertCircle className="h-3 w-3" />
                                Como obter credenciais do {platform.name}
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              </DialogContent>
            </Dialog>

            {/* Edit/Reconnect Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    {editingIntegration?.is_active ? "Editar Credenciais" : "Reconectar Integração"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingIntegration?.is_active
                      ? "Atualize as credenciais da integração"
                      : "Atualize as credenciais para reconectar"}
                  </DialogDescription>
                </DialogHeader>

                {editingIntegration && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>URL do Site</Label>
                      <Input
                        value={formData.siteUrl || ""}
                        onChange={(e) => setFormData({ ...formData, siteUrl: e.target.value })}
                        placeholder="https://meusite.com.br"
                      />
                    </div>

                    {editingIntegration.platform !== "wordpress-com" && (
                      <>
                        <div className="space-y-2">
                          <Label>Usuário</Label>
                          <Input
                            value={formData.username || ""}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            placeholder="admin"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Senha de Aplicativo / API Key</Label>
                          <Input
                            type="password"
                            value={formData.apiKey || ""}
                            onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                            placeholder="Nova senha/key (deixe vazio para manter)"
                          />
                          <p className="text-xs text-muted-foreground">
                            Deixe em branco para manter a credencial atual
                          </p>
                        </div>
                      </>
                    )}

                    <Button onClick={handleEditIntegration} disabled={saving} className="w-full">
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {editingIntegration.is_active ? "Salvar e Testar" : "Reconectar e Testar"}
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </ScrollArea>

        {/* Footer with Publish Button */}
        <div className="p-6 pt-4 border-t bg-background">
          {canPublishDirectly && publishableIntegration ? (
            <Button
              onClick={handlePublish}
              disabled={publishing}
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
              size="lg"
            >
              {publishing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publicando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Publicar no {getPlatformConfig(publishableIntegration.platform)?.name}
                </>
              )}
            </Button>
          ) : activeIntegrations.length === 0 ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Nenhuma integração ativa para publicar
              </p>
              <p className="text-xs text-muted-foreground">
                Adicione ou ative uma integração para publicar
              </p>
            </div>
          ) : activeIntegrations.length > 1 ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Múltiplas integrações ativas ({activeIntegrations.length})
              </p>
              <p className="text-xs text-muted-foreground">
                Desative as integrações que não deseja usar para publicar
              </p>
            </div>
          ) : testedIntegrations.length === 0 ? (
            <div className="text-center space-y-2">
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Integração não testada
              </p>
              <p className="text-xs text-muted-foreground">
                Teste a conexão antes de publicar
              </p>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
