import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Loader2, Download, Sparkles, AlertCircle, Eye, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useBlog } from "@/hooks/useBlog";
import { ArticleSelector } from "@/components/ebooks/ArticleSelector";
import { EbookCoverPreview } from "@/components/ebooks/EbookCoverPreview";
import { EbookContentPreview } from "@/components/ebooks/EbookContentPreview";
import { EbookFullPreview } from "@/components/ebooks/EbookFullPreview";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Article {
  id: string;
  title: string;
  content: string;
  featured_image_url: string | null;
}

interface Ebook {
  id: string;
  title: string;
  status: string;
  word_count_target: number;
  content: string | null;
  cover_image_url: string | null;
  author: string | null;
  logo_url: string | null;
  light_color: string;
  accent_color: string;
  cta_title: string | null;
  cta_body: string | null;
  cta_button_text: string | null;
  cta_button_link: string | null;
  pdf_url: string | null;
  source_article_id: string | null;
  error_message: string | null;
  download_count?: number;
  slug?: string;
  is_public?: boolean;
}

export default function ClientEbookEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { blog } = useBlog();
  const { toast } = useToast();
  const isNew = id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [ebook, setEbook] = useState<Partial<Ebook>>({
    title: "",
    word_count_target: 1200,
    light_color: "#f8fafc",
    accent_color: "#6366f1",
    cta_title: "Gostou do conteúdo?",
    cta_body: "Entre em contato conosco para saber mais sobre como podemos ajudar seu negócio.",
    cta_button_text: "Fale Conosco",
    cta_button_link: "",
  });

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (blog) {
      fetchEbook();
    }
  }, [user, id, blog]);

  // Polling for ebook status when generating
  useEffect(() => {
    if (ebook.status !== "generating" || !id || isNew) return;
    
    const pollInterval = setInterval(async () => {
      const { data: ebookData } = await supabase
        .from("ebooks")
        .select("status, content, cover_image_url, pdf_url, error_message")
        .eq("id", id)
        .maybeSingle();
      
      if (ebookData) {
        if (ebookData.status === "ready") {
          setEbook((prev) => ({ 
            ...prev, 
            status: "ready",
            content: ebookData.content,
            cover_image_url: ebookData.cover_image_url,
            pdf_url: ebookData.pdf_url,
            error_message: null
          }));
          setGenerating(false);
          toast({ title: "eBook gerado com sucesso!" });
          clearInterval(pollInterval);
        } else if (ebookData.status === "error") {
          setEbook((prev) => ({ 
            ...prev, 
            status: "error",
            error_message: ebookData.error_message
          }));
          setGenerating(false);
          toast({ title: "Erro ao gerar eBook", description: ebookData.error_message || "", variant: "destructive" });
          clearInterval(pollInterval);
        }
      }
    }, 3000);
    
    return () => clearInterval(pollInterval);
  }, [ebook.status, id, isNew]);

  const fetchEbook = async () => {
    if (!blog) return;

    // Set defaults from blog
    setEbook((prev) => ({
      ...prev,
      author: prev.author || "",
      logo_url: prev.logo_url || blog.logo_url || "",
      accent_color: prev.accent_color || blog.primary_color || "#6366f1",
    }));

    if (!isNew && id) {
      try {
        const { data: ebookData } = await supabase
          .from("ebooks")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (ebookData) {
          setEbook(ebookData);
          if (ebookData.status === "generating") {
            setGenerating(true);
          }
          if (ebookData.source_article_id) {
            const { data: articleData } = await supabase
              .from("articles")
              .select("id, title, content, featured_image_url")
              .eq("id", ebookData.source_article_id)
              .maybeSingle();
            setSelectedArticle(articleData);
          }
        }
      } catch (error) {
        console.error("Error fetching ebook:", error);
      }
    }
    
    setLoading(false);
  };

  const handleSave = async () => {
    if (!blog || !selectedArticle) {
      toast({ title: "Selecione um artigo de referência", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const ebookData = {
        blog_id: blog.id,
        source_article_id: selectedArticle.id,
        title: ebook.title || selectedArticle.title,
        word_count_target: ebook.word_count_target,
        author: ebook.author,
        logo_url: ebook.logo_url,
        light_color: ebook.light_color,
        accent_color: ebook.accent_color,
        cta_title: ebook.cta_title,
        cta_body: ebook.cta_body,
        cta_button_text: ebook.cta_button_text,
        cta_button_link: ebook.cta_button_link,
        ...(isNew && { status: "draft" }),
      };

      if (isNew) {
        const { data, error } = await supabase
          .from("ebooks")
          .insert(ebookData)
          .select()
          .single();

        if (error) throw error;
        toast({ title: "eBook salvo com sucesso!" });
        navigate(`/client/ebooks/${data.id}`);
      } else {
        const { error } = await supabase
          .from("ebooks")
          .update(ebookData)
          .eq("id", id);

        if (error) throw error;
        toast({ title: "eBook atualizado!" });
      }
    } catch (error) {
      console.error("Error saving ebook:", error);
      toast({ title: "Erro ao salvar eBook", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!blog || !selectedArticle || !id || isNew) {
      toast({ title: "Salve o eBook antes de gerar", variant: "destructive" });
      return;
    }

    setGenerating(true);
    try {
      await supabase.from("ebooks").update({ status: "generating", error_message: null }).eq("id", id);
      setEbook((prev) => ({ ...prev, status: "generating", error_message: null }));

      const { data: result, error: invokeError } = await supabase.functions.invoke('generate-ebook-content', {
        body: {
          ebook_id: id,
          article_id: selectedArticle.id,
          article_title: selectedArticle.title,
          article_content: selectedArticle.content,
          word_count_target: ebook.word_count_target,
          author: ebook.author,
          logo_url: ebook.logo_url,
          light_color: ebook.light_color,
          accent_color: ebook.accent_color,
          cta_title: ebook.cta_title,
          cta_body: ebook.cta_body,
          cta_button_text: ebook.cta_button_text,
          cta_button_link: ebook.cta_button_link,
        }
      });

      if (invokeError) {
        throw new Error(invokeError.message || "Erro ao gerar eBook");
      }

      if (result?.error) {
        throw new Error(result.error);
      }

      toast({ title: "eBook gerado com sucesso!" });
      fetchEbook();
    } catch (error) {
      console.error("Error generating ebook:", error);
      await supabase
        .from("ebooks")
        .update({ status: "error", error_message: error instanceof Error ? error.message : "Erro desconhecido" })
        .eq("id", id);
      setEbook((prev) => ({ ...prev, status: "error", error_message: error instanceof Error ? error.message : "Erro desconhecido" }));
      toast({ title: "Erro ao gerar eBook", description: error instanceof Error ? error.message : "", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleArticleSelect = (article: Article) => {
    setSelectedArticle(article);
    if (!ebook.title) {
      setEbook((prev) => ({ ...prev, title: article.title }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusBadge = () => {
    switch (ebook.status) {
      case "ready":
        return <Badge className="bg-green-500/10 text-green-500">Pronto</Badge>;
      case "generating":
        return <Badge className="bg-yellow-500/10 text-yellow-500">Gerando...</Badge>;
      case "error":
        return <Badge className="bg-red-500/10 text-red-500">Erro</Badge>;
      default:
        return <Badge variant="secondary">Rascunho</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/client/ebooks")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-bold text-foreground">
                {isNew ? "Novo eBook" : "Detalhes do eBook"}
              </h1>
              {!isNew && statusBadge()}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
          {!isNew && ebook.status !== "ready" && (
            <Button className="gradient-primary gap-2" onClick={handleGenerate} disabled={generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Gerar eBook
            </Button>
          )}
          {ebook.status === "ready" && (
            <>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShowFullPreview(true)}
              >
                <Eye className="h-4 w-4" />
                Visualizar
              </Button>
              {ebook.slug && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.open(`/ebook/${ebook.slug}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  Landing Page
                </Button>
              )}
            </>
          )}
          {ebook.pdf_url && (
            <Button
              className="gap-2"
              onClick={async () => {
                setDownloading(true);
                try {
                  if (!ebook.pdf_url) {
                    toast({ title: "PDF não disponível", variant: "destructive" });
                    return;
                  }
                  
                  const response = await fetch(ebook.pdf_url, { method: 'HEAD' });
                  if (!response.ok) {
                    toast({ 
                      title: "PDF não encontrado", 
                      description: "Tente regenerar o eBook",
                      variant: "destructive" 
                    });
                    return;
                  }
                  
                  await supabase
                    .from('ebooks')
                    .update({ download_count: (ebook.download_count || 0) + 1 })
                    .eq('id', id);
                  
                  const link = document.createElement('a');
                  link.href = ebook.pdf_url;
                  link.download = `${ebook.title || 'ebook'}.pdf`;
                  link.target = '_blank';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  
                  toast({ title: "Download iniciado!" });
                } catch (error) {
                  console.error('Download error:', error);
                  toast({ 
                    title: "Erro no download", 
                    description: "Verifique sua conexão e tente novamente",
                    variant: "destructive" 
                  });
                } finally {
                  setDownloading(false);
                }
              }}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Baixar PDF
            </Button>
          )}
        </div>
      </div>

      {/* Full Preview Dialog */}
      <EbookFullPreview
        open={showFullPreview}
        onOpenChange={setShowFullPreview}
        title={ebook.title || ""}
        author={ebook.author || ""}
        content={ebook.content || null}
        coverImageUrl={ebook.cover_image_url || null}
        accentColor={ebook.accent_color || "#6366f1"}
        lightColor={ebook.light_color || "#f8fafc"}
        ctaTitle={ebook.cta_title || undefined}
        ctaBody={ebook.cta_body || undefined}
        ctaButtonText={ebook.cta_button_text || undefined}
      />

      {/* Generation Banner */}
      {ebook.status !== "ready" && !isNew && (
        <Alert className="border-primary/20 bg-primary/5">
          <Sparkles className="h-4 w-4 text-primary" />
          <AlertDescription className="text-foreground">
            <strong>Pronto para gerar?</strong> Clique em "Gerar eBook" para criar o conteúdo expandido,
            capa e PDF automaticamente.
          </AlertDescription>
        </Alert>
      )}

      {ebook.error_message && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{ebook.error_message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Artigo de Referência</CardTitle>
            </CardHeader>
            <CardContent>
              <ArticleSelector
                blogId={blog?.id || ""}
                selectedArticle={selectedArticle}
                onSelect={handleArticleSelect}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configurações do eBook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Título do eBook</Label>
                <Input
                  value={ebook.title || ""}
                  onChange={(e) => setEbook({ ...ebook, title: e.target.value })}
                  placeholder="Título do eBook"
                />
              </div>

              <div className="space-y-2">
                <Label>Autor</Label>
                <Input
                  value={ebook.author || ""}
                  onChange={(e) => setEbook({ ...ebook, author: e.target.value })}
                  placeholder="Nome do autor"
                />
              </div>

              <div className="space-y-2">
                <Label>Tamanho do conteúdo</Label>
                <Select
                  value={String(ebook.word_count_target)}
                  onValueChange={(v) => setEbook({ ...ebook, word_count_target: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="800">Curto (~800 palavras)</SelectItem>
                    <SelectItem value="1200">Médio (~1.200 palavras)</SelectItem>
                    <SelectItem value="2000">Longo (~2.000 palavras)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cor de fundo</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={ebook.light_color || "#f8fafc"}
                      onChange={(e) => setEbook({ ...ebook, light_color: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={ebook.light_color || "#f8fafc"}
                      onChange={(e) => setEbook({ ...ebook, light_color: e.target.value })}
                      placeholder="#f8fafc"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cor de destaque</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={ebook.accent_color || "#6366f1"}
                      onChange={(e) => setEbook({ ...ebook, accent_color: e.target.value })}
                      className="w-12 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={ebook.accent_color || "#6366f1"}
                      onChange={(e) => setEbook({ ...ebook, accent_color: e.target.value })}
                      placeholder="#6366f1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Banner de CTA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Título do CTA</Label>
                <Input
                  value={ebook.cta_title || ""}
                  onChange={(e) => setEbook({ ...ebook, cta_title: e.target.value })}
                  placeholder="Gostou do conteúdo?"
                />
              </div>

              <div className="space-y-2">
                <Label>Texto do CTA</Label>
                <Textarea
                  value={ebook.cta_body || ""}
                  onChange={(e) => setEbook({ ...ebook, cta_body: e.target.value })}
                  placeholder="Entre em contato conosco..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Texto do botão</Label>
                  <Input
                    value={ebook.cta_button_text || ""}
                    onChange={(e) => setEbook({ ...ebook, cta_button_text: e.target.value })}
                    placeholder="Fale Conosco"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Link do botão</Label>
                  <Input
                    value={ebook.cta_button_link || ""}
                    onChange={(e) => setEbook({ ...ebook, cta_button_link: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="space-y-6">
          <Tabs defaultValue="cover">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="cover">Capa</TabsTrigger>
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="cta">CTA</TabsTrigger>
            </TabsList>
            <TabsContent value="cover" className="mt-4">
              <EbookCoverPreview
                title={ebook.title || selectedArticle?.title || "Título do eBook"}
                author={ebook.author || ""}
                coverImageUrl={ebook.cover_image_url || selectedArticle?.featured_image_url}
                accentColor={ebook.accent_color || "#6366f1"}
                logoUrl={ebook.logo_url || undefined}
              />
            </TabsContent>
            <TabsContent value="content" className="mt-4">
              <EbookContentPreview
                title={ebook.title || selectedArticle?.title || ""}
                content={ebook.content || selectedArticle?.content || null}
                author={ebook.author || ""}
                accentColor={ebook.accent_color || "#6366f1"}
                lightColor={ebook.light_color || "#f8fafc"}
              />
            </TabsContent>
            <TabsContent value="cta" className="mt-4">
              <Card className="overflow-hidden" style={{ backgroundColor: ebook.light_color || "#f8fafc" }}>
                <CardContent className="p-8 text-center">
                  <h3 
                    className="text-2xl font-bold mb-4"
                    style={{ color: ebook.accent_color || "#6366f1" }}
                  >
                    {ebook.cta_title || "Gostou do conteúdo?"}
                  </h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    {ebook.cta_body || "Entre em contato conosco..."}
                  </p>
                  <Button
                    style={{ backgroundColor: ebook.accent_color || "#6366f1" }}
                    className="text-white"
                  >
                    {ebook.cta_button_text || "Fale Conosco"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
