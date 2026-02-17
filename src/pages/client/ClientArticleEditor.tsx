import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useBlog } from '@/hooks/useBlog';
import { smartNavigate, getClientArticlesListPath, getClientArticleEditPath } from '@/utils/platformUrls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { streamArticle, type ArticleData, type GenerationStage } from '@/utils/streamArticle';
import { SimpleArticleForm, type SimpleFormData } from '@/components/client/SimpleArticleForm';
import { ArticlePreview } from '@/components/ArticlePreview';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { ArticleGenerationProgress } from '@/components/client/ArticleGenerationProgress';
import { ImproveArticleDialog } from '@/components/editor/ImproveArticleDialog';
import { CTAPreview } from '@/components/editor/CTAPreview';
import { ContentScorePanel } from '@/components/editor/ContentScorePanel';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { uploadImageToStorage, updateArticleImage } from '@/utils/imageUtils';
import { ensureSingleArticle } from '@/lib/articleFlowGuard';
import { getCanonicalArticleUrl, getInternalArticleUrl } from '@/utils/blogUrl';
import { useCMSIntegrations } from '@/hooks/useCMSIntegrations';
import {
  ArrowLeft,
  Save,
  Send,
  Loader2,
  FileText,
  Plus,
  Edit3,
  Eye,
  EyeOff,
  Columns,
  Sparkles,
  Image as ImageIcon,
  RefreshCw,
  ExternalLink,
  BarChart3,
  Upload,
  Unplug,
  MoreVertical,
} from 'lucide-react';
import { CMSIntegrationCenterSheet } from '@/components/cms/CMSIntegrationCenterSheet';
import { cn } from '@/lib/utils';
import { ArticlePdfDownload } from '@/components/articles/ArticlePdfDownload';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { usePlanLimits } from '@/hooks/usePlanLimits';

type EditorPhase = 'form' | 'generating' | 'editing';
type ViewMode = 'editor' | 'preview' | 'split';

interface ContentImage {
  context: string;
  url: string;
  after_section: number;
}

interface ImageGenerationProgress {
  current: number;
  total: number;
  currentContext: string;
}

const INTERNAL_ADMIN_EMAIL = 'omniseenblog@gmail.com';

export default function ClientArticleEditor() {
  const navigate = useNavigate();
  const { id: articleId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { blog, loading: blogLoading, isPlatformAdmin } = useBlog();
  const { user } = useAuth();
  const { checkLimit } = usePlanLimits();

  const showAdvanced = useMemo(() => {
    const email = user?.email?.toLowerCase();
    return isPlatformAdmin || email === INTERNAL_ADMIN_EMAIL;
  }, [isPlatformAdmin, user?.email]);

  // Quick mode params from URL
  const quickMode = searchParams.get('quick') === 'true';
  const themeParam = searchParams.get('theme');
  const modeParam = (searchParams.get('mode') as 'fast' | 'deep') || 'fast';
  const imagesParam = searchParams.get('images') !== '0';
  const fromOpportunityParam = searchParams.get('fromOpportunity'); // NEW: Support opportunity conversion

  // Track if we're editing an existing article
  const [existingArticleId, setExistingArticleId] = useState<string | null>(null);
  const [existingArticleSlug, setExistingArticleSlug] = useState<string | null>(null);

  // Track if auto-generation was triggered
  const autoGenerationTriggeredRef = useRef(false);

  // Editor phase state
  const [phase, setPhase] = useState<EditorPhase>('form');

  // View mode state (persisted in localStorage)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('article-editor-view-mode');
    return (saved as ViewMode) || 'split';
  });

  // Article state (in memory until explicit save)
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [faq, setFaq] = useState<Array<{ question: string; answer: string }>>([]);

  // Image state
  const [featuredImage, setFeaturedImage] = useState<string | null>(null);
  const [contentImages, setContentImages] = useState<ContentImage[]>([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [imageProgress, setImageProgress] = useState<ImageGenerationProgress | null>(null);

  // Generation state
  const [streamingText, setStreamingText] = useState('');
  const [generationStage, setGenerationStage] = useState<GenerationStage>(null);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const generationLockRef = useRef(false); // Prevent double-submission
  const timeoutWarningRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * V4.0: Updated stage mapping - aligned with new fast generation flow
   * Removed 'outlining' and 'optimizing' from sync flow (now background)
   */
  const mapStageToArticleEngine = (stage: GenerationStage): string | null => {
    if (!stage) return null;
    const mapping: Record<string, string> = {
      'analyzing': 'classifying',
      'generating': 'writing',
      'images': 'images',
      'finalizing': 'finalizing'
    };
    return mapping[stage] || stage;
  };

  // Handle cancel generation
  const handleCancelGeneration = () => {
    generationLockRef.current = false;
    setIsGenerating(false);
    setPhase('form');
    setGenerationStage(null);
    setGenerationProgress(0);
    setShowTimeoutWarning(false);
    setStreamingText('');
    if (timeoutWarningRef.current) {
      clearTimeout(timeoutWarningRef.current);
    }
    toast.info('Geração cancelada');
  };

  // Timeout warning effect
  useEffect(() => {
    if (isGenerating) {
      timeoutWarningRef.current = setTimeout(() => {
        setShowTimeoutWarning(true);
        toast.warning(
          'A geração está demorando mais que o esperado. Aguarde mais um momento...',
          { duration: 8000 }
        );
      }, 120000); // 2 minutes
      
      return () => {
        if (timeoutWarningRef.current) {
          clearTimeout(timeoutWarningRef.current);
          setShowTimeoutWarning(false);
        }
      };
    } else {
      setShowTimeoutWarning(false);
    }
  }, [isGenerating]);

  // Save state
  const [isSaving, setIsSaving] = useState(false);

  // Business profile for CTA preview
  const [businessProfile, setBusinessProfile] = useState<{
    company_name: string | null;
    country: string | null;
    whatsapp: string | null;
  } | null>(null);

  // Improve with AI state
  const [isImprovingArticle, setIsImprovingArticle] = useState(false);
  const [showImproveDialog, setShowImproveDialog] = useState(false);
  const [improveResults, setImproveResults] = useState<{
    improvements: { type: 'paragraph' | 'visual_block' | 'seo' | 'cta'; description: string; location?: string }[];
    stats: { addedVisualBlocks: number; fixedParagraphs: number; seoIssues: number; totalImprovements: number };
    improvedContent: string;
    originalContent: string;
  } | null>(null);

  // SERP Score Panel state (mobile sheet)
  const [showScorePanel, setShowScorePanel] = useState(false);

  // CMS Publishing state
  const [isPublishingCMS, setIsPublishingCMS] = useState(false);
  const [showCMSCenter, setShowCMSCenter] = useState(false);
  const { integrations, publishArticle, getActiveIntegration, refetch: refetchIntegrations } = useCMSIntegrations(blog?.id || '');
  const activeIntegration = getActiveIntegration();

  // CORRECTION #5: Force refetch integrations when CMS Center closes to ensure state sync
  useEffect(() => {
    if (!showCMSCenter && blog?.id) {
      refetchIntegrations();
    }
  }, [showCMSCenter, blog?.id, refetchIntegrations]);

  // Check if can publish directly (active + tested with success)
  const canPublishDirectly =
    activeIntegration && activeIntegration.is_active && activeIntegration.last_sync_status === 'connected';

  // SERP Score Panel visibility (desktop) - persisted in localStorage
  const [showScorePanelDesktop, setShowScorePanelDesktop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('contentScorePanelVisible') !== 'false';
  });

  // Persist desktop panel visibility
  useEffect(() => {
    localStorage.setItem('contentScorePanelVisible', String(showScorePanelDesktop));
  }, [showScorePanelDesktop]);

  // Derive keyword from title for SERP analysis
  const derivedKeyword = title ? title.split(' ').slice(0, 4).join(' ') : '';

  // ====================================================================
  // CONVERT OPPORTUNITY: Handle fromOpportunity param via edge function
  // ====================================================================
  const handleConvertOpportunity = async (oppId: string, blogId: string) => {
    // A) Gerar request_id no início para rastreabilidade
    const requestId = crypto.randomUUID();
    console.log(`[${requestId}][ConvertOpportunity] Starting conversion for opportunity:`, oppId);
    
    // 🔒 VERIFICAÇÃO DE LIMITE (UX - evitar tentativa inútil)
    const limitCheck = await checkLimit('articles');
    if (!limitCheck.canCreate) {
      console.log(`[${requestId}][ConvertOpportunity] BLOCKED: Article limit reached`);
      toast.error('Limite de artigos atingido', {
        description: `Você usou ${limitCheck.used}/${limitCheck.limit} artigos este mês. Faça upgrade para continuar.`,
      });
      return;
    }
    
    console.log(`[${requestId}][ConvertOpportunity] Limit OK: ${limitCheck.remaining} articles remaining`);
    
    setPhase('generating');
    setGenerationStage('analyzing');
    setGenerationProgress(10);

    const progressInterval = setInterval(() => {
      setGenerationProgress((prev) => Math.min(prev + 8, 85));
    }, 2000);

    const { data, error } = await supabase.functions.invoke('convert-opportunity-to-article', {
      body: { 
        opportunityId: oppId, 
        blogId,
        request_id: requestId
      },
    });

    // 🔴 SEMPRE limpar o timer antes de qualquer return
    clearInterval(progressInterval);

    // ❌ ERRO DE EDGE FUNCTION
    if (error) {
      console.error(`[${requestId}] Edge error`, error);
      setGenerationStage(null);
      setPhase('form');
      setGenerationProgress(0);
      toast.error('Erro ao gerar artigo', {
        description: error.message || 'Falha inesperada',
      });
      return;
    }

    // ❌ BACKEND RESPONDEU COM success=false
    if (!data?.success) {
      console.error(`[${requestId}] Backend failure`, data);
      setGenerationStage(null);
      setPhase('form');
      setGenerationProgress(0);
      toast.error('Falha na geração do artigo', {
        description: data?.message || 'Erro de validação',
      });
      return;
    }

    // ✅ SUCESSO REAL
    setGenerationStage('finalizing');
    setGenerationProgress(100);
    toast.success('Artigo criado com sucesso');
    smartNavigate(navigate, getClientArticleEditPath(data.article_id));
  };

  // Persist view mode
  useEffect(() => {
    localStorage.setItem('article-editor-view-mode', viewMode);
  }, [viewMode]);

  // Fetch business profile for CTA preview
  useEffect(() => {
    if (!blog?.id) return;

    const fetchBusinessProfile = async () => {
      const { data } = await supabase
        .from('business_profile')
        .select('company_name, country')
        .eq('blog_id', blog.id)
        .maybeSingle();

      if (data) {
        // Fetch whatsapp separately since it's a new column
        const { data: fullProfile } = await supabase
          .from('business_profile')
          .select('*')
          .eq('blog_id', blog.id)
          .maybeSingle();

        setBusinessProfile({
          company_name: data.company_name,
          country: data.country,
          whatsapp: (fullProfile as { whatsapp?: string })?.whatsapp || null,
        });
      }
    };

    fetchBusinessProfile();
  }, [blog?.id]);

  // Load existing article if editing
  useEffect(() => {
    if (articleId && blog?.id) {
      loadExistingArticle(articleId);
    }
  }, [articleId, blog?.id]);

  // ====================================================================
  // AUTO-RUN MODE: If quick=true, auto-generate or convert opportunity
  // ====================================================================
  useEffect(() => {
    // 🛡️ GUARD CRÍTICO: Se estamos editando um artigo existente, NÃO auto-gerar
    if (articleId) {
      console.log('[Auto-run] Skipping - editing existing article:', articleId);
      return;
    }

    if (
      quickMode &&
      blog?.id &&
      phase === 'form' &&
      !generationLockRef.current &&
      !autoGenerationTriggeredRef.current
    ) {
      autoGenerationTriggeredRef.current = true;

      // If fromOpportunity is provided, use edge function conversion
      if (fromOpportunityParam) {
        console.log('[Auto-run] Converting opportunity:', fromOpportunityParam);
        handleConvertOpportunity(fromOpportunityParam, blog.id);
        return;
      }

      // Otherwise, use theme-based generation
      if (themeParam) {
        console.log('[Auto-run] Quick mode detected, starting generation...');
        handleGenerate({
          theme: themeParam,
          generationMode: modeParam,
          generateImages: imagesParam,
          scheduleMode: 'now',
          scheduledDate: null,
          scheduledTime: null,
        });
      }
    }
  }, [quickMode, fromOpportunityParam, themeParam, blog?.id, phase, articleId]);

  const loadExistingArticle = async (id: string) => {
    try {
      const { data, error } = await supabase.from('articles').select('*').eq('id', id).single();

      if (error || !data) {
        toast.error('Artigo não encontrado');
        smartNavigate(navigate, getClientArticlesListPath());
        return;
      }

      // ============================================================
      // EARLY REDIRECT PATTERN: Detect status "generating" and start stream
      // ============================================================
      const articleStatus = data.status as string;
      if (articleStatus === "generating") {
        console.log("[loadExistingArticle] Detected generating status, starting stream");
        setExistingArticleId(data.id);
        setTitle(data.title || '');
        setPhase('generating');
        setIsGenerating(true);
        setGenerationStage('analyzing');
        setGenerationProgress(0);
        
        // Retrieve stored form data from localStorage
        let storedFormData: {
          theme?: string;
          generationMode?: 'fast' | 'deep';
          generateImages?: boolean;
          scheduleMode?: string;
          scheduledDate?: string;
          scheduledTime?: string;
        } = {};
        
        try {
          const stored = localStorage.getItem('pendingArticleGeneration');
          if (stored) {
            storedFormData = JSON.parse(stored);
            localStorage.removeItem('pendingArticleGeneration');
          }
        } catch (e) {
          console.warn('[loadExistingArticle] Could not parse stored form data');
        }
        
        const shouldGenerateImages = storedFormData.generateImages !== false;
        const generationMode = storedFormData.generationMode || 'fast';
        
        await streamArticle({
          theme: data.title,
          blogId: blog?.id || data.blog_id,
          generationMode,
          tone: 'friendly',
          autoPublish: true,
          onStage: (stage) => setGenerationStage(stage),
          onProgress: (percent) => setGenerationProgress(percent),
          onDelta: (text) => setStreamingText((prev) => prev + text),
          onDone: async (result) => {
            setIsGenerating(false);
            setGenerationStage(null);
            generationLockRef.current = false;

            if (result) {
              // Update state
              setTitle(result.title);
              setContent(result.content);
              setExcerpt(result.excerpt);
              setMetaDescription(result.meta_description);
              setFaq(result.faq || []);
              
              // Update placeholder with generated content
              await supabase
                .from('articles')
                .update({
                  title: result.title,
                  content: result.content,
                  excerpt: result.excerpt,
                  meta_description: result.meta_description,
                  faq: result.faq || [],
                  status: 'published',
                  published_at: new Date().toISOString(),
                })
                .eq('id', data.id);

              setPhase('editing');
              toast.success('Artigo gerado!');
              
              // Generate images if enabled
              if (shouldGenerateImages) {
                toast.info('Gerando imagens...');
                await generateImagesWithArticleId(result, data.id);
              }
            }
          },
          onError: (error) => {
            setIsGenerating(false);
            setGenerationStage(null);
            generationLockRef.current = false;
            toast.error(error || 'Erro ao gerar artigo');
            
            // Mark as draft on error
            supabase.from('articles').update({ status: 'draft' }).eq('id', data.id);
            setPhase('form');
          },
        });
        return; // Early return - generation in progress
      }

      // Normal flow for existing articles
      setExistingArticleId(data.id);
      setExistingArticleSlug(data.slug || null);
      setTitle(data.title || '');
      setContent(data.content || '');
      setExcerpt(data.excerpt || '');
      setMetaDescription(data.meta_description || '');
      setFaq(Array.isArray(data.faq) ? (data.faq as unknown as Array<{ question: string; answer: string }>) : []);
      setFeaturedImage(data.featured_image_url || null);
      setContentImages(Array.isArray(data.content_images) ? (data.content_images as unknown as ContentImage[]) : []);
      setPhase('editing'); // Go directly to editing mode

      console.log(
        `[Load Article] id=${id}, title="${data.title?.substring(0, 30)}...", hasImage=${!!data.featured_image_url}`
      );

      // =========================================================================
      // AUTO-DETECT MISSING IMAGES
      // =========================================================================
      if (!data.featured_image_url && data.content && data.content.length > 200) {
        console.log(`[Load Article] Article ${id} has no images, prompting generation...`);
        toast.info('Este artigo não tem imagens. Use o menu de ações para gerar.', {
          duration: 5000,
          action: {
            label: 'Gerar Agora',
            onClick: () => {
              handleGenerateMissingImages(data.id, data.title, data.content);
            },
          },
        });
      }
    } catch (err) {
      console.error('Error loading article:', err);
      toast.error('Erro ao carregar artigo');
    }
  };

  // Function to generate images for articles that are missing them
  const handleGenerateMissingImages = async (artId: string, artTitle: string, artContent: string) => {
    if (!blog?.id) return;

    setIsGeneratingImages(true);
    toast.info('Gerando imagens para o artigo...');

    const articleData: ArticleData = {
      title: artTitle,
      content: artContent,
      excerpt: '',
      meta_description: '',
      faq: [],
      image_prompts: [],
    };

    await generateImagesWithArticleId(articleData, artId);
  };

  // Current article object for preview
  const articleForPreview: ArticleData | null = title
    ? {
        title,
        content,
        excerpt,
        meta_description: metaDescription,
        faq,
        featured_image_url: featuredImage,
        content_images: contentImages,
      }
    : null;

  // ============================================================
  // EARLY REDIRECT PATTERN: Create placeholder and navigate immediately
  // ============================================================
  const createArticlePlaceholder = async (blogId: string, theme: string): Promise<string | null> => {
    console.log("[CLICK][GEN_ARTICLE] createArticlePlaceholder iniciado", {
      timestamp: new Date().toISOString(),
      blogId,
      theme,
    });

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      const { data: { session } } = await supabase.auth.getSession();
      
      console.log("[AUTH][GEN_ARTICLE]", {
        userId: user?.id,
        email: user?.email,
        expiresAt: session?.expires_at,
        authError: authError?.message,
      });

      if (!user) {
        console.error("[AUTH][GEN_ARTICLE] User null - sessão expirada");
        toast.error("Sessão expirada. Faça login novamente.");
        return null;
      }

      // Validate blog ownership
      const { data: blogData, error: blogError } = await supabase
        .from('blogs')
        .select('user_id')
        .eq('id', blogId)
        .single();

      console.log("[BLOG][GEN_ARTICLE]", {
        blogOwnerId: blogData?.user_id,
        currentUserId: user.id,
        match: blogData?.user_id === user.id,
        blogError: blogError?.message,
      });

      const slug = theme
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .substring(0, 60) + `-${Date.now()}`;

      console.log("[INSERT][GEN_ARTICLE] Attempting insert...", { blogId, slug, status: "generating" });

      const { data, error } = await supabase
        .from("articles")
        .insert({
          blog_id: blogId,
          title: theme,
          slug,
          status: "generating",
          generation_source: "form",
        })
        .select("id")
        .single();

      if (error) {
        console.error("[INSERT-ERROR][GEN_ARTICLE]", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });
        toast.error(`Erro ao criar artigo: ${error.message}`);
        return null;
      }

      console.log("[INSERT-SUCCESS][GEN_ARTICLE]", { articleId: data.id });
      return data.id;
    } catch (err: any) {
      console.error("[EXCEPTION][GEN_ARTICLE]", err);
      toast.error(err.message || "Erro inesperado ao criar artigo");
      return null;
    }
  };

  const handleGenerate = async (formData: SimpleFormData) => {
    console.log("[ENTER][GEN_ARTICLE][handleGenerate]", {
      timestamp: new Date().toISOString(),
      route: location.pathname,
      blogId: blog?.id,
      blogLoading,
      theme: formData.theme,
    });

    if (!blog?.id) {
      console.error("[BLOG-NULL][GEN_ARTICLE] blog.id não existe", { blog });
      toast.error('Blog não encontrado. Recarregue a página.');
      return;
    }

    if (generationLockRef.current) {
      console.warn('[GUARD] Generation already in progress, blocking duplicate request');
      return;
    }
    generationLockRef.current = true;

    try {
      // Check for duplicates
      const flowResult = await ensureSingleArticle(blog.id, formData.theme);

      if (flowResult.action === 'update' && flowResult.articleId) {
        console.log(`[GUARD] Article already exists with id=${flowResult.articleId}, redirecting to edit`);
        toast.info('Artigo com este tema já existe. Abrindo para edição...');
        generationLockRef.current = false;
        navigate(`/client/articles/${flowResult.articleId}/edit`);
        return;
      }

      // 1. Create placeholder IMMEDIATELY
      const placeholderId = await createArticlePlaceholder(blog.id, formData.theme);
      if (!placeholderId) {
        generationLockRef.current = false;
        return;
      }

      // Store form data for generation inside editor
      localStorage.setItem('pendingArticleGeneration', JSON.stringify({
        theme: formData.theme,
        generationMode: formData.generationMode,
        generateImages: formData.generateImages,
        scheduleMode: formData.scheduleMode,
        scheduledDate: formData.scheduledDate?.toISOString(),
        scheduledTime: formData.scheduledTime,
      }));

      console.log("[NAVIGATING][GEN_ARTICLE]", { placeholderId });
      
      // 2. Navigate IMMEDIATELY to the editor
      navigate(`/client/articles/${placeholderId}/edit`, { replace: true });
      
    } catch (err: any) {
      console.error("[EXCEPTION][handleGenerate]", err);
      generationLockRef.current = false;
      toast.error(err.message || "Erro ao iniciar geração");
    }
  };

  // Dedicated function for generating images with a known article_id
  const generateImagesWithArticleId = async (articleData: ArticleData, articleId: string) => {
    if (!blog?.id) return;

    setIsGeneratingImages(true);
    const totalImages = 4;

    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      setImageProgress({ current: 1, total: totalImages, currentContext: 'Imagem de capa' });

      const { data: coverResult } = await supabase.functions.invoke('generate-image', {
        body: {
          articleTitle: articleData.title,
          articleTheme: articleData.title,
          context: 'cover',
          blog_id: blog.id,
          article_id: articleId,
          user_id: currentUser?.id,
        },
      });

      if (coverResult) {
        let coverUrl = coverResult?.publicUrl || null;

        if (!coverUrl && coverResult?.imageBase64) {
          const fileName = `cover-${articleId}-${Date.now()}.png`;
          coverUrl = await uploadImageToStorage(coverResult.imageBase64, fileName);

          if (coverUrl) {
            await updateArticleImage(articleId, 'cover', coverUrl);
          }
        }

        if (coverUrl) {
          setFeaturedImage(coverUrl);
          console.log('[generateImagesWithArticleId] Cover image persisted:', coverUrl);
        }
      }

      const imagePrompts = articleData.image_prompts || [];
      const newContentImages: ContentImage[] = [];

      for (let i = 0; i < Math.min(imagePrompts.length, 3); i++) {
        const prompt = imagePrompts[i];
        setImageProgress({
          current: i + 2,
          total: totalImages,
          currentContext: prompt.context || `Imagem ${i + 1}`,
        });

        const { data: imgResult } = await supabase.functions.invoke('generate-image', {
          body: {
            prompt: prompt.prompt,
            context: prompt.context,
            articleTitle: articleData.title,
            articleTheme: articleData.title,
            blog_id: blog.id,
            article_id: articleId,
            user_id: currentUser?.id,
          },
        });

        if (imgResult) {
          let imgUrl = imgResult?.publicUrl || null;

          if (!imgUrl && imgResult?.imageBase64) {
            const fileName = `${prompt.context}-${articleId}-${Date.now()}.png`;
            imgUrl = await uploadImageToStorage(imgResult.imageBase64, fileName);
          }

          if (imgUrl) {
            newContentImages.push({
              context: prompt.context,
              url: imgUrl,
              after_section: prompt.after_section,
            });
          }
        }
      }

      setContentImages(newContentImages);

      if (newContentImages.length > 0) {
        await updateArticleImage(articleId, 'content', '', newContentImages);
      }

      toast.success('Imagens geradas e salvas!');
    } catch (error) {
      console.error('Error generating images:', error);
      toast.error('Erro ao gerar algumas imagens');
    } finally {
      setIsGeneratingImages(false);
      setImageProgress(null);
    }
  };

  const handleSave = async (publish: boolean) => {
    if (!blog?.id || !title.trim() || !content.trim()) {
      toast.error('Preencha o título e conteúdo');
      return;
    }

    setIsSaving(true);

    try {
      const contentImagesJson = contentImages.length > 0
        ? contentImages.map((img) => ({
            context: img.context,
            url: img.url,
            after_section: img.after_section,
          }))
        : null;

      if (existingArticleId) {
        const updateData = {
          title: title.trim(),
          content: content.trim(),
          excerpt: excerpt.trim(),
          meta_description: metaDescription.trim(),
          faq: faq.length > 0 ? faq : null,
          featured_image_url: featuredImage,
          content_images: contentImagesJson as unknown as null,
          status: publish ? 'published' : 'draft',
          published_at: publish ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('articles').update(updateData).eq('id', existingArticleId);

        if (error) throw error;

        toast.success(publish ? 'Artigo publicado!' : 'Alterações salvas!');
        navigate('/client/articles');
        return;
      }

      toast.error('Artigo ainda não foi persistido. Gere novamente.');
    } catch (error) {
      console.error('Error saving article:', error);
      toast.error('Erro ao salvar artigo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewArticle = () => {
    setPhase('form');
    setTitle('');
    setContent('');
    setExcerpt('');
    setMetaDescription('');
    setFaq([]);
    setFeaturedImage(null);
    setContentImages([]);
    setStreamingText('');
  };

  const handleImproveWithAI = async () => {
    if (!content || !title) {
      toast.error('É necessário ter conteúdo e título para melhorar');
      return;
    }

    setIsImprovingArticle(true);

    try {
      let fetchedBusinessProfile = null;
      if (blog?.id) {
        const { data: profileData } = await supabase
          .from('business_profile')
          .select('company_name, niche, tone_of_voice, country')
          .eq('blog_id', blog.id)
          .single();

        if (profileData) {
          const { data: fullProfile } = await supabase
            .from('business_profile')
            .select('*')
            .eq('blog_id', blog.id)
            .maybeSingle();

          fetchedBusinessProfile = {
            ...profileData,
            whatsapp: (fullProfile as { whatsapp?: string })?.whatsapp,
          };
        }
      }

      const response = await supabase.functions.invoke('improve-article-complete', {
        body: {
          content,
          title,
          metaDescription,
          keywords: [],
          businessProfile: fetchedBusinessProfile
            ? {
                company_name: fetchedBusinessProfile.company_name,
                niche: fetchedBusinessProfile.niche,
                tone_of_voice: fetchedBusinessProfile.tone_of_voice,
                country: fetchedBusinessProfile.country,
                whatsapp: fetchedBusinessProfile.whatsapp,
              }
            : undefined,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const { improvedContent, improvements, stats } = response.data;

      if (stats.totalImprovements > 0) {
        setImproveResults({
          improvements,
          stats,
          improvedContent,
          originalContent: content,
        });

        setContent(improvedContent);
        setShowImproveDialog(true);

        toast.success(`${stats.totalImprovements} melhorias aplicadas!`);
      } else {
        toast.success('Artigo já otimizado! Nenhuma melhoria necessária.');
      }
    } catch (error) {
      console.error('Error improving article:', error);
      toast.error('Erro ao melhorar artigo', {
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      });
    } finally {
      setIsImprovingArticle(false);
    }
  };

  const handleKeepImprovements = () => {
    setShowImproveDialog(false);
    setImproveResults(null);
    toast.success('Melhorias mantidas com sucesso!');
  };

  const handleDiscardImprovements = () => {
    if (improveResults?.originalContent) {
      setContent(improveResults.originalContent);
    }
    setShowImproveDialog(false);
    setImproveResults(null);
    toast.info('Melhorias descartadas');
  };

  const handleOpenSite = () => {
    if (!existingArticleId || !existingArticleSlug || !blog) return;

    const canonicalUrl = getCanonicalArticleUrl(blog, existingArticleSlug);
    const internalUrl = getInternalArticleUrl(blog.slug, existingArticleSlug);

    const hasValidSubdomain =
      blog.platform_subdomain &&
      blog.platform_subdomain.endsWith('.app.omniseen.app') &&
      blog.platform_subdomain !== 'blog.app.omniseen.app';

    if (hasValidSubdomain || (blog.custom_domain && blog.domain_verified)) {
      window.open(canonicalUrl, '_blank');
      return;
    }

    toast.info('Abrindo preview interno. Configure o domínio para URL pública.');
    window.open(internalUrl, '_blank');
  };

  const handlePublishToCMS = async () => {
    if (!existingArticleId || !activeIntegration) return;

    setIsPublishingCMS(true);
    try {
      const result = await publishArticle(activeIntegration.id, existingArticleId);

      if (result.success) {
        toast.success(`Publicado com sucesso!`, {
          description: result.externalUrl
            ? `Artigo disponível em ${
                activeIntegration.platform === 'wordpress'
                  ? 'WordPress'
                  : activeIntegration.platform === 'wordpress-com'
                    ? 'WordPress.com'
                    : 'Wix'
              }`
            : undefined,
          action: result.externalUrl
            ? {
                label: 'Abrir',
                onClick: () => window.open(result.externalUrl!, '_blank'),
              }
            : undefined,
        });
        if (result.externalUrl) {
          window.open(result.externalUrl, '_blank');
        }
        return;
      }

      toast.error(`Erro ao publicar: ${result.message || 'Erro desconhecido'}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro inesperado ao publicar no CMS';
      console.error('CMS publish click error:', e);
      toast.error(msg);
    } finally {
      setIsPublishingCMS(false);
    }
  };

  if (blogLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Render editor content
  const renderEditor = () => (
    <div className="space-y-4 h-full flex flex-col">
      {/* Title Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Título</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título do artigo"
          className="text-lg font-semibold"
        />
      </div>

      {/* Excerpt Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Resumo</label>
        <Input value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Breve resumo do artigo" />
      </div>

      {/* Image Progress */}
      {isGeneratingImages && imageProgress && (
        <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <div className="flex items-center gap-3 mb-2">
            <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
            <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
              Gerando imagens ({imageProgress.current}/{imageProgress.total})
            </span>
          </div>
          <Progress value={(imageProgress.current / imageProgress.total) * 100} className="h-2" />
          <p className="text-xs text-muted-foreground mt-1">{imageProgress.currentContext}</p>
        </div>
      )}

      {/* Featured Image Preview */}
      {featuredImage && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Imagem de Capa</label>
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img src={featuredImage} alt="Featured" className="w-full h-32 object-cover" />
          </div>
        </div>
      )}

      {/* CTA Preview */}
      {businessProfile?.company_name && phase === 'editing' && (
        <CTAPreview
          companyName={businessProfile.company_name}
          city={businessProfile.country || undefined}
          whatsapp={businessProfile.whatsapp || undefined}
        />
      )}

      {/* Content Editor */}
      <div className="flex-1 min-h-0 space-y-2">
        <label className="text-sm font-medium text-foreground">Conteúdo</label>
        <div className="h-full min-h-[400px]">
          <RichTextEditor value={content} onChange={setContent} placeholder="Edite o conteúdo do artigo..." />
        </div>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="h-full overflow-auto">
      <ArticlePreview
        article={articleForPreview}
        streamingText=""
        isStreaming={false}
        featuredImage={featuredImage}
        contentImages={contentImages as import('@/utils/generateContentImages').ContentImage[]}
        isGeneratingImages={isGeneratingImages}
        imageProgress={imageProgress ? {
          current: imageProgress.current,
          total: imageProgress.total,
          context: imageProgress.currentContext,
          status: 'generating',
        } : null}
      />
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex flex-col gap-3 pb-4 border-b border-border mb-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/client/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>

            {phase === 'editing' && (
              <Button variant="outline" size="sm" onClick={handleNewArticle}>
                <Plus className="h-4 w-4 mr-2" />
                Novo
              </Button>
            )}
          </div>

          {phase === 'editing' && (
            <div className="flex items-center gap-2">
              {/* Ações principais sempre visíveis */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleImproveWithAI}
                disabled={isImprovingArticle || !content || !title}
                className="gap-2 border-purple-500/30 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10"
              >
                {isImprovingArticle ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Melhorando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Melhorar
                  </>
                )}
              </Button>

              <Button variant="outline" size="sm" onClick={() => handleSave(false)} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar
              </Button>

              <Button size="sm" onClick={() => handleSave(true)} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Publicar
              </Button>

              {/* Ações secundárias em menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <MoreVertical className="h-4 w-4" />
                    Mais
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {existingArticleId && existingArticleSlug && blog && (
                    <DropdownMenuItem onClick={handleOpenSite} className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Ver no site
                    </DropdownMenuItem>
                  )}

                  {!featuredImage && content && content.length > 100 && existingArticleId && (
                    <DropdownMenuItem
                      onClick={() => handleGenerateMissingImages(existingArticleId, title, content)}
                      disabled={isGeneratingImages}
                      className="gap-2"
                    >
                      {isGeneratingImages ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
                      Gerar imagens
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    onClick={() => setShowScorePanelDesktop((prev) => !prev)}
                    className="gap-2"
                  >
                    {showScorePanelDesktop ? <EyeOff className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}
                    {showScorePanelDesktop ? 'Ocultar score' : 'Mostrar score'}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* CMS */}
                  {existingArticleId && (
                    canPublishDirectly && activeIntegration ? (
                      <DropdownMenuItem
                        onClick={handlePublishToCMS}
                        disabled={isPublishingCMS}
                        className="gap-2"
                      >
                        {isPublishingCMS ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        Publicar no {activeIntegration.platform === 'wordpress'
                          ? 'WordPress'
                          : activeIntegration.platform === 'wordpress-com'
                            ? 'WordPress.com'
                            : 'Wix'}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => setShowCMSCenter(true)} className="gap-2">
                        <Unplug className="h-4 w-4" />
                        {integrations.length > 0 ? 'Gerenciar CMS' : 'Conectar CMS'}
                      </DropdownMenuItem>
                    )
                  )}

                  {/* PDF apenas para conta interna/admin (reduz ruído no MVP) */}
                  {showAdvanced && existingArticleId && title && (
                    <div className="px-2 py-1.5">
                      <ArticlePdfDownload
                        articleId={existingArticleId}
                        articleTitle={title}
                        variant="compact"
                      />
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <CMSIntegrationCenterSheet
                blogId={blog?.id || ''}
                articleId={existingArticleId || undefined}
                open={showCMSCenter}
                onOpenChange={async (open) => {
                  setShowCMSCenter(open);
                  if (!open) {
                    await refetchIntegrations();
                  }
                }}
                onPublishSuccess={(url) => window.open(url, '_blank')}
              />
            </div>
          )}
        </div>

        {/* View Mode Tabs (desktop) */}
        {phase === 'editing' && (
          <div className="flex items-center justify-between gap-3">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="hidden md:block">
              <TabsList className="h-9">
                <TabsTrigger value="editor" className="gap-1.5 px-3 h-7">
                  <Edit3 className="h-3.5 w-3.5" />
                  Editor
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-1.5 px-3 h-7">
                  <Eye className="h-3.5 w-3.5" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="split" className="gap-1.5 px-3 h-7">
                  <Columns className="h-3.5 w-3.5" />
                  Lado a Lado
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Mobile score */}
            <Sheet open={showScorePanel} onOpenChange={setShowScorePanel}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 md:hidden border-indigo-500/30 text-indigo-600 dark:text-indigo-400"
                >
                  <BarChart3 className="h-4 w-4" />
                  Score
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px] p-0">
                <ContentScorePanel
                  articleId={existingArticleId || undefined}
                  content={content}
                  title={title}
                  keyword={derivedKeyword}
                  blogId={blog?.id || ''}
                  onContentUpdate={(newContent) => setContent(newContent)}
                />
              </SheetContent>
            </Sheet>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        {phase === 'form' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full min-h-0">
            <SimpleArticleForm onGenerate={handleGenerate} isGenerating={isGenerating} />
            <Card className="h-full flex items-center justify-center bg-muted/30 border-dashed">
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-muted-foreground">Preview do Artigo</h3>
                <p className="text-sm text-muted-foreground mt-1">O artigo aparecerá aqui enquanto é gerado</p>
              </CardContent>
            </Card>
          </div>
        )}

        {phase === 'generating' && (
          <>
            {/* Overlay com progresso detalhado */}
            <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="w-full max-w-lg">
                <ArticleGenerationProgress
                  currentStage={mapStageToArticleEngine(generationStage)}
                  progress={generationProgress}
                  showTimeoutWarning={showTimeoutWarning}
                  keyword={title || themeParam || 'Artigo'}
                  onCancel={handleCancelGeneration}
                />
              </div>
            </div>
            
            {/* Preview em background (visual apenas) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full opacity-30 pointer-events-none">
              <Card className="h-full" />
              <ArticlePreview article={null} streamingText={streamingText} isStreaming={isGenerating} />
            </div>
          </>
        )}

        {phase === 'editing' && (
          <>
            {/* Mobile: Always show editor */}
            <div className="md:hidden h-full overflow-auto">{renderEditor()}</div>

            {/* Desktop: Based on view mode */}
            <div className="hidden md:block h-full">
              {viewMode === 'editor' && (
                <div
                  className={cn(
                    'grid gap-4 h-full transition-all duration-300',
                    showScorePanelDesktop ? 'grid-cols-[1fr_320px]' : 'grid-cols-1'
                  )}
                >
                  <div className="overflow-auto">{renderEditor()}</div>

                  {showScorePanelDesktop && (
                    <div className="h-full overflow-hidden">
                      <ContentScorePanel
                        articleId={existingArticleId || undefined}
                        content={content}
                        title={title}
                        keyword={derivedKeyword}
                        blogId={blog?.id || ''}
                        onContentUpdate={(newContent) => setContent(newContent)}
                      />
                    </div>
                  )}
                </div>
              )}

              {viewMode === 'preview' && (
                <div
                  className={cn(
                    'grid gap-4 h-full transition-all duration-300',
                    showScorePanelDesktop ? 'grid-cols-[1fr_320px]' : 'grid-cols-1'
                  )}
                >
                  {renderPreview()}

                  {showScorePanelDesktop && (
                    <div className="h-full overflow-hidden">
                      <ContentScorePanel
                        articleId={existingArticleId || undefined}
                        content={content}
                        title={title}
                        keyword={derivedKeyword}
                        blogId={blog?.id || ''}
                        onContentUpdate={(newContent) => setContent(newContent)}
                      />
                    </div>
                  )}
                </div>
              )}

              {viewMode === 'split' && (
                <div
                  className={cn(
                    'grid gap-4 h-full transition-all duration-300',
                    showScorePanelDesktop ? 'grid-cols-[1fr_1fr_320px]' : 'grid-cols-[1fr_1fr]'
                  )}
                >
                  <div className="overflow-auto">{renderEditor()}</div>
                  {renderPreview()}

                  {showScorePanelDesktop && (
                    <div className="h-full overflow-hidden">
                      <ContentScorePanel
                        articleId={existingArticleId || undefined}
                        content={content}
                        title={title}
                        keyword={derivedKeyword}
                        blogId={blog?.id || ''}
                        onContentUpdate={(newContent) => setContent(newContent)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Improve Article Dialog */}
      {improveResults && (
        <ImproveArticleDialog
          open={showImproveDialog}
          onOpenChange={setShowImproveDialog}
          improvements={improveResults.improvements}
          stats={improveResults.stats}
          onKeep={handleKeepImprovements}
          onDiscard={handleDiscardImprovements}
        />
      )}
    </div>
  );
}