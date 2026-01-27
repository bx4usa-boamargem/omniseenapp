import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRef } from "react";
import { 
  Sparkles, 
  Save, 
  Eye, 
  ExternalLink, 
  Loader2, 
  ArrowLeft,
  Settings,
  Globe,
  Trash2,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useBlog } from "@/hooks/useBlog";
import { useLandingPages } from "./hooks/useLandingPages";
import { LandingPagePreview } from "./LandingPagePreview";
import { ServiceAuthorityLayout } from "./layouts/ServiceAuthorityLayout";
import { ServiceAuthorityProLayout } from "./layouts/ServiceAuthorityProLayout";
import { InstitutionalLayout } from "./layouts/InstitutionalLayout";
import { SpecialistAuthorityLayout } from "./layouts/SpecialistAuthorityLayout";
import { TemplateSelector, LandingPageTemplate } from "./TemplateSelector";
import { LandingPageSEOPanel } from "./LandingPageSEOPanel";
import { LandingPageData, BlockVisibility, DEFAULT_BLOCK_VISIBILITY, TEMPLATE_DEFAULT_VISIBILITY, LandingPage, LandingPageTemplateType } from "./types/landingPageTypes";
import { DEFAULT_PRO_VISIBILITY } from "./types/serviceAuthorityProTypes";
import { normalizePageDataForSave, inferVisibilityFromPageData } from "./utils/pageDataNormalizer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCanonicalBlogUrl } from "@/utils/blogUrl";

interface LandingPageEditorProps {
  pageId?: string;
}

export function LandingPageEditor({ pageId }: LandingPageEditorProps) {
  const navigate = useNavigate();
  const isMounted = useRef(true); // Controle de montagem
  const { blog, loading: blogLoading } = useBlog();
  
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const { generatePage, savePage, updatePage, deletePage, publishPage, unpublishPage, generating, saving, analyzeSEO, fixSEO, regeneratePage } = useLandingPages();

  const publicBaseUrl = blog ? getCanonicalBlogUrl(blog) : "";

  const [page, setPage] = useState<LandingPage | null>(null);
  const [pageData, setPageData] = useState<LandingPageData | null>(null);
  const [visibility, setVisibility] = useState<BlockVisibility>(DEFAULT_BLOCK_VISIBILITY);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("preview");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<LandingPageTemplate>('service_authority_v1');
  const [isAnalyzingSEO, setIsAnalyzingSEO] = useState(false);
  const [isFixingSEO, setIsFixingSEO] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [seoKeywords, setSeoKeywords] = useState<string[]>([]);

  // Fetch business profile for generation context
  const [businessProfile, setBusinessProfile] = useState<any>(null);

  useEffect(() => {
    if (blog?.id) {
      loadBusinessProfile();
      if (pageId) {
        loadPage();
      }
    }
  }, [blog?.id, pageId]);

  const loadBusinessProfile = async () => {
    if (!blog?.id) return;
    
    const { data } = await supabase
      .from("business_profile")
      .select("*")
      .eq("blog_id", blog.id)
      .single();
    
    setBusinessProfile(data);
  };

  const loadPage = async () => {
    if (!pageId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("id", pageId)
        .single();

      if (error) throw error;
      if (!isMounted.current) return;

      const landingPage = data as unknown as LandingPage;
      setPage(landingPage);
      setPageData(landingPage.page_data);
      setTitle(landingPage.title);
      setSlug(landingPage.slug);
      setSeoTitle(landingPage.seo_title || "");
      setSeoDescription(landingPage.seo_description || "");
      setSeoKeywords(landingPage.seo_keywords || []);

      // Restore visibility from meta or apply template defaults
      if (landingPage.page_data?.meta?.block_visibility) {
        setVisibility({
          ...DEFAULT_BLOCK_VISIBILITY,
          ...landingPage.page_data.meta.block_visibility
        });
      } else {
        // Apply template-specific default visibility
        const template = landingPage.page_data?.template || 'service_authority_v1';
        const templateVisibility = TEMPLATE_DEFAULT_VISIBILITY[template as LandingPageTemplateType];
        if (templateVisibility) {
          setVisibility({
            ...DEFAULT_BLOCK_VISIBILITY,
            ...templateVisibility
          });
        } else {
          // Infer visibility based on which blocks have data
          setVisibility(inferVisibilityFromPageData(landingPage.page_data));
        }
      }
    } catch (error) {
      console.error("Error loading page:", error);
      toast.error("Erro ao carregar página");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (dataToSave?: any) => {
    const finalData = dataToSave || pageData;
    if (!blog?.id || !finalData) {
      toast.error("Dados incompletos para salvar.");
      return;
    }

    setIsSaving(true);
    try {
      // Normalize page data before saving - removes hidden blocks and persists visibility
      const normalizedData = normalizePageDataForSave(finalData, visibility);

      const result = await savePage({
        blog_id: blog.id,
        title: title || normalizedData.hero?.title || "Nova Super Página",
        slug: slug || "super-pagina-" + Date.now(),
        page_data: normalizedData,
        status: 'draft'
      });

      if (result) {
        setPage(result);
        navigate(`/client/landing-pages/${result.id}`, { replace: true });
        toast.success("Página salva no banco!");
      }
    } catch (err) {
      console.error("[Editor] Save Error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!blog?.id) return;

    // Reset state to avoid DOM conflicts during new generation
    setPageData(null);
    setPage(null);

    const result = await generatePage({
      blog_id: blog.id,
      company_name: businessProfile?.company_name,
      niche: businessProfile?.niche,
      city: businessProfile?.city,
      services: businessProfile?.services?.split(','),
      phone: businessProfile?.phone || "",
      template_type: selectedTemplate // Pass selected template
    });

    if (result) {
      // O result já vem persistido do hook useLandingPages
      // Precisamos apenas recarregar a lista ou a página atual
      window.location.reload(); // Forçar recarregamento para estabilizar a árvore React com os novos dados do DB
    }
  };

  const handlePublish = async () => {
    if (!page?.id || !pageData) return;

    // Normalize page data before publishing - removes hidden blocks and persists visibility
    const normalizedData = normalizePageDataForSave(pageData, visibility);

    // Always persist current editor state before toggling publish
    await updatePage(page.id, {
      title,
      slug,
      page_data: normalizedData,
      seo_title: seoTitle,
      seo_description: seoDescription,
    });

    if (page.status === "published") {
      const ok = await unpublishPage(page.id);
      if (ok) {
        setPage((prev) => (prev ? { ...prev, status: "draft" } : null));
        await loadPage();
      }
      return;
    }

    const ok = await publishPage(page.id);
    if (ok) {
      setPage((prev) => (prev ? { ...prev, status: "published" } : null));
      // Reload to reflect generated images + final published data
      await loadPage();
    }
  };

  const handleDelete = async () => {
    if (!page?.id) return;
    
    const success = await deletePage(page.id);
    if (success) {
      navigate("/client/landing-pages");
    }
  };

  const handleEditBlock = (blockType: string, data: any) => {
    if (!pageData) return;

    // Usar atualização funcional para garantir que o React veja a mudança de estado como uma nova árvore
    setPageData(prev => {
      if (!prev) return prev;
      
      // Deep clone para evitar mutação direta que quebra o DOM virtual
      const updated = JSON.parse(JSON.stringify(prev));
      
      if (blockType.includes('.')) {
        const parts = blockType.split('.');
        let target: any = updated;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]]) target[parts[i]] = {};
          target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = data.value;
      } else if (data.index !== undefined) {
        // Suporte para arrays (ex: serviços, depoimentos)
        const arr = updated[blockType as keyof LandingPageData] as any[];
        if (arr && arr[data.index]) {
          arr[data.index] = { ...arr[data.index], [data.field]: data.value };
        }
      } else {
        (updated as any)[blockType] = { ...updated[blockType], [data.field]: data.value };
      }

      return updated;
    });
  };

  const toggleBlockVisibility = (block: keyof BlockVisibility) => {
    setVisibility(prev => ({ ...prev, [block]: !prev[block] }));
  };

  const handleReanalyze = async () => {
    if (!page?.id) return;
    setIsAnalyzingSEO(true);
    try {
      const result = await analyzeSEO(page.id);
      if (result?.success) {
        // Reload page to get updated SEO data
        await loadPage();
        toast.success("Análise SEO concluída!");
      }
    } finally {
      setIsAnalyzingSEO(false);
    }
  };

  const handleAutoFix = async () => {
    if (!page?.id) return;
    setIsFixingSEO(true);
    try {
      const result = await fixSEO(page.id, ["title", "meta", "content", "keywords"]);
      if (result?.success) {
        // Reload page to get updated SEO data
        await loadPage();
      }
    } finally {
      setIsFixingSEO(false);
    }
  };

  const handleRegenerate = async () => {
    if (!page?.id) return;
    setIsRegenerating(true);
    try {
      const result = await regeneratePage(page.id);
      if (result) {
        // Reload page to get updated content
        await loadPage();
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  if (blogLoading || loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/client/landing-pages")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">
              {page ? "Editar Landing Page" : "Nova Landing Page"}
            </h1>
            {page?.status === "published" && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <Globe className="w-3 h-3" /> Publicada
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!pageData && (
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Gerar com IA
                </>
              )}
            </Button>
          )}

          {pageData && (
            <>
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Salvar
              </Button>

              {page && (
                <>
                  <Button 
                    variant={page.status === "published" ? "outline" : "default"}
                    onClick={handlePublish}
                  >
                    {page.status === "published" ? "Despublicar" : "Publicar"}
                  </Button>

                  {page.status === "published" && (
                    <Button variant="ghost" size="icon" asChild>
                      <a 
                        href={`${publicBaseUrl}/p/${page.slug}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                  )}

                  <Button variant="outline" onClick={() => window.open(`/p/${slug}`, '_blank')}>
                    <Eye className="w-4 h-4 mr-2" />
                    Preview Published
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Landing Page?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. A página será permanentemente removida.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Settings */}
        <div className="w-80 border-r bg-card overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="w-full rounded-none border-b">
              <TabsTrigger value="preview" className="flex-1">
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="settings" className="flex-1">
                <Settings className="w-4 h-4 mr-2" />
                Config
              </TabsTrigger>
              {page && (
                <TabsTrigger value="seo" className="flex-1">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  SEO
                </TabsTrigger>
              )}
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="preview" className="p-4 m-0 space-y-4">
                {/* Template Selector - Only show when no page data yet */}
                {!pageData && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Escolher Template</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <TemplateSelector
                        value={selectedTemplate}
                        onChange={setSelectedTemplate}
                        disabled={generating}
                      />
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Blocos Visíveis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(visibility).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between">
                        <Label htmlFor={key} className="text-sm capitalize">
                          {key.replace(/_/g, " ")}
                        </Label>
                        <Switch
                          id={key}
                          checked={value}
                          onCheckedChange={() => toggleBlockVisibility(key as keyof BlockVisibility)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {pageData && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleGenerate}
                    disabled={generating}
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Regenerar Página
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="settings" className="p-4 m-0 space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="title">Título da Página</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Dedetização em São Paulo"
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor="slug">URL (slug)</Label>
                    <Input
                      id="slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                      placeholder="ex: dedetizacao-sao-paulo"
                      className="mt-1.5"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      URL: /{slug || "slug-da-pagina"}
                    </p>
                  </div>
                </div>

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="seo">
                    <AccordionTrigger className="text-sm">SEO</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div>
                        <Label htmlFor="seoTitle">Título SEO</Label>
                        <Input
                          id="seoTitle"
                          value={seoTitle}
                          onChange={(e) => setSeoTitle(e.target.value)}
                          placeholder="Título para buscadores"
                          className="mt-1.5"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {seoTitle.length}/60 caracteres
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="seoDescription">Meta Description</Label>
                        <Textarea
                          id="seoDescription"
                          value={seoDescription}
                          onChange={(e) => setSeoDescription(e.target.value)}
                          placeholder="Descrição para buscadores"
                          className="mt-1.5"
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {seoDescription.length}/160 caracteres
                        </p>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </TabsContent>

              {/* SEO Tab */}
              {page && (
                <TabsContent value="seo" className="m-0 h-full overflow-y-auto">
                  <LandingPageSEOPanel
                    pageId={page.id}
                    pageData={pageData}
                    seoTitle={seoTitle}
                    seoDescription={seoDescription}
                    seoKeywords={seoKeywords}
                    seoScore={page.seo_score}
                    seoMetrics={page.seo_metrics}
                    seoRecommendations={page.seo_recommendations}
                    seoAnalyzedAt={page.seo_analyzed_at}
                    onReanalyze={handleReanalyze}
                    onAutoFix={handleAutoFix}
                    onRegenerate={handleRegenerate}
                    isAnalyzing={isAnalyzingSEO}
                    isFixing={isFixingSEO}
                    isRegenerating={isRegenerating}
                  />
                </TabsContent>
              )}
            </div>
          </Tabs>
        </div>

        {/* Right Panel - Preview */}
        <div className="flex-1 bg-muted/30 overflow-hidden relative">
          {pageData ? (
            <div className="absolute inset-0 overflow-y-auto">
              <div className="max-w-[1200px] mx-auto shadow-2xl shadow-black/10 min-h-full">
                {pageData.template === 'service_authority_pro_v1' ? (
                  <ServiceAuthorityProLayout
                    pageData={pageData as any}
                    primaryColor={blog?.primary_color || "#8b5cf6"}
                    visibility={visibility as any}
                    isEditing={true}
                    onEditBlock={handleEditBlock}
                  />
                ) : pageData.template === 'institutional_v1' ? (
                  <InstitutionalLayout
                    pageData={pageData}
                    primaryColor={blog?.primary_color || "#475569"}
                    visibility={visibility}
                    isEditing={true}
                    onEditBlock={handleEditBlock}
                  />
                ) : pageData.template === 'specialist_authority_v1' ? (
                  <SpecialistAuthorityLayout
                    pageData={pageData}
                    primaryColor={blog?.primary_color || "#d97706"}
                    visibility={visibility}
                    isEditing={true}
                    onEditBlock={handleEditBlock}
                  />
                ) : pageData.template === 'service_authority_v1' ? (
                  <ServiceAuthorityLayout
                    pageData={pageData}
                    primaryColor={blog?.primary_color || "#2563eb"}
                    visibility={visibility}
                    isEditing={true}
                    onEditBlock={handleEditBlock}
                  />
                ) : (
                  <LandingPagePreview
                    pageData={pageData}
                    blogId={blog?.id || ""}
                    primaryColor={blog?.primary_color}
                    visibility={visibility}
                    isEditing={false}
                    onEditBlock={handleEditBlock}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <Sparkles className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Crie sua Landing Page
              </h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Clique em "Gerar com IA" para criar automaticamente uma landing page
                profissional baseada no perfil da sua empresa.
              </p>
              <Button size="lg" onClick={handleGenerate} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Gerando página...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Gerar Landing Page com IA
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}