import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBlog } from "@/hooks/useBlog";
import { useToast } from "@/hooks/use-toast";
import { useLocaleFormat } from "@/hooks/useLocaleFormat";
import { useArticleChatDraft } from "@/hooks/useArticleChatDraft";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ArticleChatInterface } from "@/components/article-chat/ArticleChatInterface";
import { ArticlePreview } from "@/components/ArticlePreview";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, ArrowLeft, Save, FileText, Eye, MessageCircle, Mic, Cloud, CloudUpload } from "lucide-react";

interface ArticleData {
  title: string;
  excerpt: string;
  meta_description: string;
  content: string;
  keywords: string[];
  faq?: Array<{ question: string; answer: string }>;
  featured_image_url?: string;
}

export default function NewArticleChat() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { blog, loading: blogLoading } = useBlog();
  const { toast } = useToast();
  const { formatDate } = useLocaleFormat();
  
  const [generatedArticle, setGeneratedArticle] = useState<ArticleData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Use draft hook - must be called unconditionally
  const { 
    draft, 
    isLoading: draftLoading, 
    isSaving: draftSaving, 
    lastSaved, 
    updateDraft, 
    clearDraft 
  } = useArticleChatDraft(blog?.id || '');

  if (authLoading || blogLoading || draftLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !blog) {
    navigate("/auth");
    return null;
  }

  const handleArticleGenerated = (article: ArticleData) => {
    setGeneratedArticle(article);
    setPreviewOpen(true);
  };

  const handleSaveArticle = async (status: 'draft' | 'published') => {
    if (!generatedArticle) return;

    // Alert if publishing without keywords
    if (status === 'published' && (!generatedArticle.keywords || generatedArticle.keywords.length === 0)) {
      const confirmed = window.confirm(
        "Este artigo não possui palavras-chave. Artigos sem keywords têm desempenho SEO muito inferior. Deseja publicar mesmo assim?"
      );
      if (!confirmed) return;
    }

    setIsSaving(true);

    try {
      // Generate slug
      const slug = generatedArticle.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const { data, error } = await supabase
        .from('articles')
        .insert({
          blog_id: blog.id,
          title: generatedArticle.title,
          slug,
          excerpt: generatedArticle.excerpt,
          meta_description: generatedArticle.meta_description,
          content: generatedArticle.content,
          keywords: generatedArticle.keywords,
          faq: generatedArticle.faq || [],
          featured_image_url: generatedArticle.featured_image_url || null,
          status,
          published_at: status === 'published' ? new Date().toISOString() : null,
          generation_source: 'chat'
        })
        .select()
        .single();

      if (error) throw error;

      // Clear the draft after saving article
      await clearDraft();

      toast({
        title: status === 'published' ? "Artigo publicado!" : "Rascunho salvo!",
        description: `"${generatedArticle.title}" foi ${status === 'published' ? 'publicado' : 'salvo'} com sucesso.`
      });

      navigate(`/app/articles/${data.id}/edit`);
    } catch (error) {
      console.error('Error saving article:', error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Erro desconhecido"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/app/articles/new')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  Chat com IA
                </h1>
                <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">
                  até ~800 palavras
                </span>
              </div>
              <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                Artigos rápidos — digite ou use o microfone
                <Mic className="h-3 w-3" />
              </p>
              <p className="text-xs text-muted-foreground/80 mt-1">
                Este modo é ideal para criar artigos rápidos e humanizados. Para artigos longos (1500+ palavras), use PDF, URL ou YouTube.
              </p>
                {/* Auto-save indicator */}
                {(lastSaved || draftSaving) && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
                    {draftSaving ? (
                      <>
                        <CloudUpload className="h-3 w-3 animate-pulse" />
                        Salvando...
                      </>
                    ) : lastSaved ? (
                      <>
                        <Cloud className="h-3 w-3" />
                        Salvo às {formatDate(lastSaved, 'HH:mm')}
                      </>
                    ) : null}
                  </span>
                )}
              </div>
            </div>
          </div>

          {generatedArticle && (
            <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Ver Artigo
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
                <SheetHeader className="px-6 py-4 border-b">
                  <SheetTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Artigo Gerado
                  </SheetTitle>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-10rem)]">
                  <div className="p-6 space-y-6">
                    {/* Article Info */}
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Título</p>
                        <p className="font-semibold text-lg">{generatedArticle.title}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Resumo</p>
                        <p className="text-sm">{generatedArticle.excerpt}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Palavras-chave</p>
                        <div className="flex flex-wrap gap-1">
                          {generatedArticle.keywords.map((kw, i) => (
                            <span key={i} className="text-xs bg-muted px-2 py-1 rounded">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Content Preview */}
                    <div className="border rounded-lg p-4">
                      <ArticlePreview 
                        article={{
                          title: generatedArticle.title,
                          excerpt: generatedArticle.excerpt,
                          content: generatedArticle.content,
                          meta_description: generatedArticle.meta_description,
                          faq: generatedArticle.faq || []
                        }}
                        streamingText=""
                        isStreaming={false}
                      />
                    </div>
                  </div>
                </ScrollArea>

                {/* Actions */}
                <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => handleSaveArticle('draft')}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salvar Rascunho
                    </Button>
                    <Button 
                      className="flex-1"
                      onClick={() => handleSaveArticle('published')}
                      disabled={isSaving}
                    >
                      {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Publicar
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>

        {/* Chat Area - Full Width & Height */}
        <div className="flex-1 flex items-center justify-center p-6 bg-muted/30">
          <div className="w-full max-w-3xl h-full">
            <ArticleChatInterface 
              blogId={blog.id}
              onArticleGenerated={handleArticleGenerated}
              initialDraft={draft}
              onDraftChange={updateDraft}
              className="h-full min-h-[500px]"
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
