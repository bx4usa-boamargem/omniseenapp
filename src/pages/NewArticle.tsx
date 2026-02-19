import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { CreateContentGrid } from "@/components/content/CreateContentGrid";
import { FunnelModal } from "@/components/content/FunnelModal";
import { AISuggestionModal } from "@/components/content/AISuggestionModal";
import { KeywordsModal } from "@/components/content/KeywordsModal";
import { ArticleUrlModal } from "@/components/content/ArticleUrlModal";
import { YouTubeModal } from "@/components/content/YouTubeModal";
import { InstagramModal } from "@/components/content/InstagramModal";
import { CsvModal } from "@/components/content/CsvModal";
import { PdfModal, type Chunk } from "@/components/content/PdfModal";
import { OpportunityCard } from "@/components/content/OpportunityCard";
import { ArticleForm } from "@/components/ArticleForm";
import { ArticlePreview } from "@/components/ArticlePreview";
import { PublishWithTranslationDialog } from "@/components/editor/PublishWithTranslationDialog";
import { type ArticleData } from "@/types/article";
import { generateContentImages, type ContentImage, type ImageGenerationProgress } from "@/utils/generateContentImages";
import { 
  ArrowLeft, 
  Save, 
  Send, 
  RefreshCw, 
  Loader2,
  AlertCircle,
  Sparkles
} from "lucide-react";

interface GenerationParams {
  theme: string;
  keywords: string[];
  tone: 'formal' | 'casual' | 'technical' | 'friendly';
  category: string;
  generateCoverImage: boolean;
  generateContentImages: boolean;
  contentImageCount: number;
  wordCount: number;
  sectionCount: number;
  includeFaq: boolean;
  includeConclusion: boolean;
  includeVisualBlocks: boolean;
  optimizeForAI: boolean;
  funnelMode?: 'top' | 'middle' | 'bottom';
  articleGoal?: 'educar' | 'autoridade' | 'apoiar_vendas' | 'converter' | null;
  generationMode?: 'fast' | 'deep'; // NOVO - fast (400-1000) ou deep (1500-3000)
}

interface Opportunity {
  id: string;
  suggested_title: string;
  suggested_keywords: string[] | null;
}

export default function NewArticle() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [blogId, setBlogId] = useState<string | null>(null);
  const [showArticleForm, setShowArticleForm] = useState(false);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [selectedOpportunities, setSelectedOpportunities] = useState<string[]>([]);
  
  // Modal states
  const [funnelModalOpen, setFunnelModalOpen] = useState(false);
  const [aiSuggestionModalOpen, setAiSuggestionModalOpen] = useState(false);
  const [keywordsModalOpen, setKeywordsModalOpen] = useState(false);
  const [articleUrlModalOpen, setArticleUrlModalOpen] = useState(false);
  const [youtubeModalOpen, setYoutubeModalOpen] = useState(false);
  const [instagramModalOpen, setInstagramModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [featuredImage, setFeaturedImage] = useState<string | null>(null);
  const [contentImages, setContentImages] = useState<ContentImage[]>([]);
  const [imageProgress, setImageProgress] = useState<ImageGenerationProgress | null>(null);
  const [currentParams, setCurrentParams] = useState<GenerationParams | null>(null);
  const [generationSource, setGenerationSource] = useState<'chat' | 'instagram' | 'youtube' | 'pdf' | 'url' | 'form'>('form');
  const [generationError, setGenerationError] = useState<{
    title: string;
    message: string;
    suggestion: string;
  } | null>(null);
  
  // Initial theme for pre-filling ArticleForm
  const [initialTheme, setInitialTheme] = useState("");
  const [initialKeywords, setInitialKeywords] = useState<string[]>([]);
  const [opportunityId, setOpportunityId] = useState<string | null>(null);
  
  // Publish with translation modal
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      const { data: blogData } = await supabase
        .from('blogs')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (blogData) {
        setBlogId(blogData.id);
        
        // Fetch pending opportunities
        const { data: oppsData } = await supabase
          .from('article_opportunities')
          .select('id, suggested_title, suggested_keywords')
          .eq('blog_id', blogData.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(3);
        
        if (oppsData) {
          setOpportunities(oppsData);
        }
      }
    }
    
    fetchData();
    
    // Check for manual mode from URL
    if (searchParams.get('mode') === 'manual') {
      setShowArticleForm(true);
    }
    
    // Check for opportunity params from URL (from "Criar Artigo" button)
    const titleParam = searchParams.get('title');
    const keywordsParam = searchParams.get('keywords');
    const oppIdParam = searchParams.get('opportunityId');
    
    if (titleParam) {
      setInitialTheme(titleParam);
      setShowArticleForm(true);
      
      if (keywordsParam) {
        setInitialKeywords(keywordsParam.split(',').filter(k => k.trim()));
      }
      
      if (oppIdParam) {
        setOpportunityId(oppIdParam);
      }
    }
  }, [user, searchParams]);

  const handleSourceSelect = (sourceId: string) => {
    setInitialTheme("");
    
    switch (sourceId) {
      case 'chat':
        navigate('/app/articles/new-chat');
        break;
      case 'ai-suggestion':
        setAiSuggestionModalOpen(true);
        break;
      case 'keywords':
        setKeywordsModalOpen(true);
        break;
      case 'funnel':
        setFunnelModalOpen(true);
        break;
      case 'article':
        setArticleUrlModalOpen(true);
        break;
      case 'youtube':
        setYoutubeModalOpen(true);
        break;
      case 'instagram':
        setInstagramModalOpen(true);
        break;
      case 'csv':
        setCsvModalOpen(true);
        break;
      case 'pdf':
        setPdfModalOpen(true);
        break;
    }
  };

  // Modal handlers
  const handleAISuggestionContinue = (data: { instructions: string; quantity: number }) => {
    const theme = data.instructions 
      ? `Sugestão da IA:\n\nInstruções: ${data.instructions}\n\nQuantidade desejada: ${data.quantity} artigo(s)`
      : `Sugestão da IA: Crie um artigo relevante para o público do blog.`;
    setInitialTheme(theme);
    setShowArticleForm(true);
  };

  const handleKeywordsContinue = (keywords: string[]) => {
    const theme = `Análise de palavras-chave:\n\n${keywords.map(k => `• ${k}`).join('\n')}\n\nCrie um artigo otimizado para SEO baseado nestas palavras-chave.`;
    setInitialTheme(theme);
    setShowArticleForm(true);
  };

  const handleArticleUrlContinue = (data: { links: string[]; isText: boolean; text?: string }) => {
    let theme: string;
    if (data.isText && data.text) {
      theme = `Reescreva o seguinte conteúdo com sua voz:\n\n${data.text}`;
    } else {
      theme = `Reescreva os artigos dos seguintes links:\n\n${data.links.map(l => `• ${l}`).join('\n')}`;
    }
    setInitialTheme(theme);
    setGenerationSource('url');
    setShowArticleForm(true);
  };

  const handleYouTubeContinue = async (data: { links: string[]; embedVideo: boolean }) => {
    if (data.links.length === 1) {
      // Single video - extract transcript
      try {
        toast({ title: "Importando vídeo...", description: "Extraindo transcrição do YouTube." });
        
        const { data: videoData, error } = await supabase.functions.invoke('import-youtube', {
          body: { url: data.links[0] }
        });
        
        if (error) throw error;
        
        const theme = `Baseado no vídeo "${videoData.title}":\n\n${videoData.transcript || 'Transcrição não disponível.'}${data.embedVideo ? '\n\n[Incluir vídeo embedado no artigo]' : ''}`;
        setInitialTheme(theme);
        setGenerationSource('youtube');
        setShowArticleForm(true);
      } catch (error) {
        console.error('Error importing YouTube:', error);
        toast({
          variant: "destructive",
          title: "Erro ao importar",
          description: error instanceof Error ? error.message : "Não foi possível processar o vídeo.",
        });
      }
    } else {
      // Multiple videos - add to queue
      if (!blogId) return;
      
      try {
        const queueItems = data.links.map(link => ({
          blog_id: blogId,
          suggested_theme: `Vídeo YouTube: ${link}`,
          status: 'pending',
          generation_source: 'youtube',
        }));

        const { error } = await supabase.from('article_queue').insert(queueItems);
        if (error) throw error;

        toast({
          title: "Vídeos adicionados!",
          description: `${data.links.length} vídeos foram adicionados à fila de geração.`,
        });
        navigate('/articles');
      } catch (error) {
        console.error('Error adding to queue:', error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível adicionar os vídeos à fila.",
        });
      }
    }
  };

  const handleInstagramContinue = (data: { posts: Array<{ url: string; type: string; suggestedTitle: string; content: string }> }) => {
    if (data.posts.length === 1) {
      // Single post - generate one article
      const post = data.posts[0];
      const theme = `Baseado no post do Instagram "${post.suggestedTitle}":\n\n${post.content}`;
      setInitialTheme(theme);
      setGenerationSource('instagram');
      setShowArticleForm(true);
    } else if (data.posts.length > 1 && blogId) {
      // Multiple posts - add to queue
      const queueItems = data.posts.map(post => ({
        blog_id: blogId,
        suggested_theme: `Instagram: ${post.suggestedTitle}\n\n${post.content.substring(0, 500)}`,
        status: 'pending',
        generation_source: 'instagram',
      }));

      supabase.from('article_queue').insert(queueItems).then(({ error }) => {
        if (error) {
          toast({
            variant: "destructive",
            title: "Erro",
            description: "Não foi possível adicionar os posts à fila.",
          });
        } else {
          toast({
            title: "Posts adicionados!",
            description: `${data.posts.length} posts foram adicionados à fila de geração.`,
          });
          navigate('/articles');
        }
      });
    }
  };

  const handleCsvContinue = async (data: { themes: string[] }) => {
    if (!blogId) return;
    
    try {
      const queueItems = data.themes.map(theme => ({
        blog_id: blogId,
        suggested_theme: theme.trim(),
        status: 'pending',
        generation_source: 'csv',
      }));

      const { error } = await supabase.from('article_queue').insert(queueItems);
      if (error) throw error;

      toast({
        title: "Pautas adicionadas!",
        description: `${data.themes.length} pautas foram adicionadas à fila de geração.`,
      });
      navigate('/articles');
    } catch (error) {
      console.error('Error adding to queue:', error);
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Não foi possível adicionar as pautas à fila.",
      });
    }
  };

  const handlePdfContinue = async (data: { 
    text: string; 
    articleCount?: number; 
    chunks?: Chunk[];
    mode: 'multiple' | 'summarized';
  }) => {
    // Mode: Multiple articles from chunks
    if (data.mode === 'multiple' && data.chunks && data.chunks.length > 0 && blogId) {
      try {
        toast({
          title: "Adicionando à fila...",
          description: `${data.chunks.length} artigos sendo adicionados.`,
        });

        const queueItems = data.chunks.map(chunk => ({
          blog_id: blogId,
          suggested_theme: chunk.suggestedTitle,
          status: 'pending',
          generation_source: 'pdf',
          chunk_content: chunk.text.substring(0, 50000), // Limit to 50k chars per chunk
        }));

        const { error } = await supabase.from('article_queue').insert(queueItems);
        if (error) throw error;

        toast({
          title: "Artigos adicionados à fila!",
          description: `${data.chunks.length} artigos do PDF serão gerados automaticamente.`,
        });
        navigate('/articles');
      } catch (error) {
        console.error('Error adding chunks to queue:', error);
        toast({
          variant: "destructive",
          title: "Erro",
          description: "Não foi possível adicionar os artigos à fila.",
        });
      }
      return;
    }

    // Mode: Single summarized article
    if (data.mode === 'summarized') {
      const MAX_TEXT_LENGTH = 15000;
      
      // Check if document needs summarization
      if (data.text.length > MAX_TEXT_LENGTH) {
        try {
          toast({
            title: "Sumarizando documento...",
            description: "A IA está criando um resumo inteligente. Isso pode levar alguns segundos.",
          });

          const { data: summaryData, error: summaryError } = await supabase.functions.invoke('summarize-document', {
            body: { text: data.text.substring(0, 100000), targetWords: 2000 }
          });

          if (summaryError) throw summaryError;

          if (summaryData.error) {
            throw new Error(summaryData.error);
          }

          const theme = `Baseado no resumo do documento:\n\n${summaryData.summary}`;
          setInitialTheme(theme);
          setGenerationSource('pdf');
          setShowArticleForm(true);
          
          toast({
            title: "Documento sumarizado!",
            description: `${summaryData.originalWordCount?.toLocaleString() || 'Muitas'} palavras resumidas para ${summaryData.summaryWordCount?.toLocaleString() || '~2000'}.`,
          });
        } catch (error) {
          console.error('Error summarizing document:', error);
          toast({
            variant: "destructive",
            title: "Erro ao sumarizar",
            description: error instanceof Error ? error.message : "Não foi possível sumarizar o documento.",
          });
          // Fallback to truncated text
          const truncatedText = data.text.substring(0, MAX_TEXT_LENGTH) + '\n\n[...documento truncado...]';
          const theme = `Baseado no documento:\n\n${truncatedText}`;
          setInitialTheme(theme);
          setGenerationSource('pdf');
          setShowArticleForm(true);
        }
      } else {
        // Document is small enough, use directly
        const theme = `Baseado no documento:\n\n${data.text}`;
        setInitialTheme(theme);
        setGenerationSource('pdf');
        setShowArticleForm(true);
      }
      return;
    }

    // Legacy fallback (shouldn't reach here normally)
    const MAX_TEXT_LENGTH = 15000;
    const truncatedText = data.text.length > MAX_TEXT_LENGTH 
      ? data.text.substring(0, MAX_TEXT_LENGTH) + '\n\n[...documento truncado...]'
      : data.text;
    
    const theme = `Baseado no documento:\n\n${truncatedText}`;
    setInitialTheme(theme);
    setShowArticleForm(true);
  };

  const handleFunnelContinue = (data: { personaId: string; topOfFunnel: number; middleOfFunnel: number; bottomOfFunnel: number }) => {
    toast({
      title: "Artigos na fila!",
      description: `${data.topOfFunnel + data.middleOfFunnel + data.bottomOfFunnel} artigos foram adicionados à fila.`,
    });
  };

  const handleOpportunityApprove = async (id: string) => {
    if (!blogId) return;
    
    await supabase
      .from('article_opportunities')
      .update({ status: 'approved' })
      .eq('id', id);
    
    setOpportunities(prev => prev.filter(o => o.id !== id));
    toast({ title: "Oportunidade aprovada" });
  };

  const handleOpportunityArchive = async (id: string) => {
    if (!blogId) return;
    
    await supabase
      .from('article_opportunities')
      .update({ status: 'archived' })
      .eq('id', id);
    
    setOpportunities(prev => prev.filter(o => o.id !== id));
    toast({ title: "Oportunidade arquivada" });
  };

  const generateAllImages = async (articleData: ArticleData, params: GenerationParams) => {
    if (!params) return;
    
    setIsGeneratingImages(true);
    
    try {
      const heroPrompt = params.generateCoverImage
        ? `Professional editorial hero image for article: "${articleData.title}". Modern, clean, high-quality illustration style.`
        : '';
      
      const imagePromptsToUse = params.generateContentImages && articleData.image_prompts
        ? articleData.image_prompts.slice(0, params.contentImageCount)
        : [];

      if (!params.generateCoverImage && !params.generateContentImages) {
        setIsGeneratingImages(false);
        return;
      }

      const { heroImage, contentImages: images } = await generateContentImages(
        imagePromptsToUse,
        heroPrompt,
        params.theme,
        (progress) => setImageProgress(progress)
      );

      if (heroImage && params.generateCoverImage) {
        setFeaturedImage(heroImage);
      }
      
      if (images.length > 0) {
        setContentImages(images);
      }

      const totalGenerated = (heroImage && params.generateCoverImage ? 1 : 0) + images.length;
      const totalExpected = (params.generateCoverImage ? 1 : 0) + (params.generateContentImages ? params.contentImageCount : 0);

      toast({
        title: "Imagens geradas!",
        description: `${totalGenerated} de ${totalExpected} imagens criadas.`,
      });
    } catch (error) {
      console.error('Error generating images:', error);
      toast({
        variant: "destructive",
        title: "Erro ao gerar imagens",
        description: "Algumas imagens não puderam ser geradas.",
      });
    } finally {
      setIsGeneratingImages(false);
      setImageProgress(null);
    }
  };

  const handleGenerate = async (params: GenerationParams) => {
    if (!params || !blogId) return;
    
    setCurrentParams(params);
    setIsGenerating(true);
    setGenerationError(null);

    try {
      // Engine v1: create async job and redirect
      const { data, error } = await supabase.functions.invoke('create-generation-job', {
        body: {
          keyword: params.theme,
          blog_id: blogId,
          city: '',
          niche: 'default',
          country: 'BR',
          language: 'pt-BR',
          job_type: 'article',
          intent: 'informational',
          target_words: params.wordCount || 2500,
          image_count: params.generateContentImages ? params.contentImageCount : 4,
        },
      });

      if (error) throw error;

      if (data?.job_id) {
        console.log(`[FRONT:JOB_CREATED] job=${data.job_id} keyword="${params.theme}"`);
        navigate(`/client/articles/engine/${data.job_id}`);
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (err: any) {
      setIsGenerating(false);
      const msg = err?.message || '';
      
      if (msg.includes('429') || msg.includes('MAX_CONCURRENT')) {
        toast({ variant: "destructive", title: "Limite atingido", description: "Você já tem artigos em geração. Aguarde." });
      } else {
        toast({ variant: "destructive", title: "Erro ao gerar artigo", description: msg || 'Tente novamente.' });
      }
      
      setGenerationError({
        title: "Erro na Geração",
        message: msg || 'Erro desconhecido',
        suggestion: "Tente novamente com mais detalhes sobre o tema."
      });
    }
  };

  const handleSave = async (publish: boolean, translateLanguages: string[] = []) => {
    if (!article || !blogId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Nenhum artigo para salvar ou blog não encontrado.",
      });
      return;
    }

    setIsSaving(true);
    setShowPublishDialog(false);

    try {
      const baseSlug = article.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60);

      // Verificar colisão de slug e gerar sufixo inteligente (-2, -3, etc.)
      const { data: existingSlugs } = await supabase
        .from('articles')
        .select('slug')
        .eq('blog_id', blogId)
        .like('slug', `${baseSlug}%`);
      
      let finalSlug = baseSlug;
      if (existingSlugs && existingSlugs.some(a => a.slug === baseSlug)) {
        let counter = 2;
        while (existingSlugs.some(a => a.slug === `${baseSlug}-${counter}`)) {
          counter++;
        }
        finalSlug = `${baseSlug}-${counter}`;
      }

      const insertData: Record<string, unknown> = {
        blog_id: blogId,
        title: article.title,
        slug: finalSlug,
        content: article.content,
        excerpt: article.excerpt,
        meta_description: article.meta_description,
        faq: article.faq,
        featured_image_url: featuredImage || null,
        content_images: contentImages.length > 0 ? contentImages : null,
        category: currentParams?.category || null,
        keywords: currentParams?.keywords || [],
        status: publish ? 'published' : 'draft',
        published_at: publish ? new Date().toISOString() : null,
      };

      const { data: insertedArticle, error } = await supabase
        .from('articles')
        .insert(insertData as never)
        .select('id')
        .single();

      if (error) throw error;

      // Link opportunity to created article if opportunityId exists
      if (opportunityId && insertedArticle) {
        await supabase
          .from('article_opportunities')
          .update({
            status: 'used',
            converted_article_id: insertedArticle.id,
            converted_at: new Date().toISOString(),
          })
          .eq('id', opportunityId);
      }

      toast({
        title: publish ? "Artigo publicado!" : "Rascunho salvo!",
        description: publish 
          ? "O artigo está disponível no seu blog." 
          : "O artigo foi salvo como rascunho.",
      });

      // Trigger translations in background if languages selected
      if (publish && translateLanguages.length > 0 && insertedArticle) {
        setIsTranslating(true);
        toast({
          title: "Traduzindo artigo...",
          description: `Traduzindo para ${translateLanguages.length} idioma(s) em segundo plano.`,
        });

        supabase.functions.invoke('translate-article', {
          body: {
            article_id: insertedArticle.id,
            target_languages: translateLanguages,
          }
        }).then(({ error: transError }) => {
          setIsTranslating(false);
          if (transError) {
            toast({
              variant: "destructive",
              title: "Erro ao traduzir",
              description: "Algumas traduções podem não ter sido concluídas.",
            });
          } else {
            toast({
              title: "Traduções concluídas!",
              description: `O artigo foi traduzido para ${translateLanguages.length} idioma(s).`,
            });
          }
        });
      }

      navigate('/articles');
    } catch (error) {
      console.error('Error saving article:', error);
      toast({
        variant: "destructive",
        title: "Erro ao salvar",
        description: "Não foi possível salvar o artigo. Tente novamente.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishClick = () => {
    setShowPublishDialog(true);
  };

  const handlePublishWithTranslation = (translateLanguages: string[]) => {
    handleSave(true, translateLanguages);
  };

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  // Show generation view when article is being generated or exists
  if (showArticleForm || article) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => { 
                if (article) {
                  setArticle(null);
                } else {
                  setShowArticleForm(false);
                  setInitialTheme("");
                }
              }}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="font-semibold">Novo Artigo</h1>
                <p className="text-xs text-muted-foreground">Gerado com IA</p>
              </div>
            </div>
            
            {article && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => currentParams && handleGenerate(currentParams)}
                  disabled={isGenerating || isSaving || isGeneratingImages}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Melhorar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSave(false)}
                  disabled={isSaving || isGeneratingImages}
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar Rascunho
                </Button>
                <Button
                  onClick={handlePublishClick}
                  disabled={isSaving || isGeneratingImages}
                  className="gradient-primary"
                >
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Publicar
                </Button>
              </div>
            )}
          </div>
        </header>

        <main className="container py-6 px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-8rem)]">
            <Card className="overflow-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="gradient-text">✨ Gerador de Artigos</span>
                </CardTitle>
                <CardDescription>
                  Digite o tema e clique em gerar. O sistema cuida do resto.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Error card - shown when generation fails */}
                {generationError && !isGenerating && !article && (
                  <Card className="border-destructive bg-destructive/5 mb-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-destructive text-lg">
                        <AlertCircle className="h-5 w-5" />
                        {generationError.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm">{generationError.message}</p>
                      <p className="text-sm text-muted-foreground">
                        <strong>Sugestão:</strong> {generationError.suggestion}
                      </p>
                      <Button 
                        onClick={() => setGenerationError(null)} 
                        variant="outline"
                        size="sm"
                      >
                        Tentar Novamente
                      </Button>
                    </CardContent>
                  </Card>
                )}
                <ArticleForm onGenerate={handleGenerate} isGenerating={isGenerating} initialTheme={initialTheme} initialKeywords={initialKeywords} />
              </CardContent>
            </Card>

            <ArticlePreview
              article={article}
              streamingText={streamingText}
              isStreaming={isGenerating}
              featuredImage={featuredImage}
              contentImages={contentImages}
              isGeneratingImages={isGeneratingImages}
              imageProgress={imageProgress}
              onRegenerateImages={() => article && currentParams && generateAllImages(article, currentParams)}
            />
          </div>
        </main>

        {/* Publish with translation modal */}
        <PublishWithTranslationDialog
          open={showPublishDialog}
          onOpenChange={setShowPublishDialog}
          onPublish={handlePublishWithTranslation}
          isPublishing={isSaving}
        />
      </div>
    );
  }

  // Hub view (default)
  return (
    <DashboardLayout>
      <div className="container py-8">
        <Button variant="ghost" onClick={() => navigate('/articles')} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Posts
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold mb-2">Criar Artigos</h1>
          <p className="text-muted-foreground">
            Crie conteúdos humanizados e em massa para o seu blog
          </p>
        </div>

        <CreateContentGrid onSelect={handleSourceSelect} />

        {opportunities.length > 0 && (
          <>
            <div className="flex items-center gap-4 my-8">
              <Separator className="flex-1" />
              <span className="text-sm text-muted-foreground">ou</span>
              <Separator className="flex-1" />
            </div>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold">
                Aprove as oportunidades que encontramos para você
              </h2>
              
              <div className="space-y-3">
                {opportunities.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    id={opp.id}
                    title={opp.suggested_title}
                    keywords={opp.suggested_keywords || undefined}
                    selected={selectedOpportunities.includes(opp.id)}
                    onToggle={() => {
                      setSelectedOpportunities(prev =>
                        prev.includes(opp.id)
                          ? prev.filter(id => id !== opp.id)
                          : [...prev, opp.id]
                      );
                    }}
                    onApprove={() => handleOpportunityApprove(opp.id)}
                    onArchive={() => handleOpportunityArchive(opp.id)}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Modals */}
        {blogId && (
          <>
            <FunnelModal
              open={funnelModalOpen}
              onOpenChange={setFunnelModalOpen}
              blogId={blogId}
              onContinue={handleFunnelContinue}
            />
            <AISuggestionModal
              open={aiSuggestionModalOpen}
              onOpenChange={setAiSuggestionModalOpen}
              onContinue={handleAISuggestionContinue}
            />
            <KeywordsModal
              open={keywordsModalOpen}
              onOpenChange={setKeywordsModalOpen}
              onContinue={handleKeywordsContinue}
            />
            <ArticleUrlModal
              open={articleUrlModalOpen}
              onOpenChange={setArticleUrlModalOpen}
              onContinue={handleArticleUrlContinue}
            />
            <YouTubeModal
              open={youtubeModalOpen}
              onOpenChange={setYoutubeModalOpen}
              onContinue={handleYouTubeContinue}
            />
            <InstagramModal
              open={instagramModalOpen}
              onOpenChange={setInstagramModalOpen}
              onContinue={handleInstagramContinue}
            />
            <CsvModal
              open={csvModalOpen}
              onOpenChange={setCsvModalOpen}
              onContinue={handleCsvContinue}
            />
            <PdfModal
              open={pdfModalOpen}
              onOpenChange={setPdfModalOpen}
              onContinue={handlePdfContinue}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
