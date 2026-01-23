import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useBlog } from '@/hooks/useBlog';
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
import { GenerationProgress } from '@/components/seo/GenerationProgress';
import { ImproveArticleDialog } from '@/components/editor/ImproveArticleDialog';
import { CTAPreview } from '@/components/editor/CTAPreview';
import { ContentScorePanel } from '@/components/editor/ContentScorePanel';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { extractImageUrl, uploadImageToStorage, updateArticleImage } from '@/utils/imageUtils';
import { ensureSingleArticle, normalizeForFingerprint } from '@/lib/articleFlowGuard';
import { getCanonicalArticleUrl } from '@/utils/blogUrl';
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
  BookOpen,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ArticlePdfDownload } from '@/components/articles/ArticlePdfDownload';

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

export default function ClientArticleEditor() {
  const navigate = useNavigate();
  const { id: articleId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { blog, loading: blogLoading } = useBlog();
  
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
  const generationLockRef = useRef(false); // Prevent double-submission
  
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
    setPhase('generating');
    setGenerationStage('analyzing');
    setGenerationProgress(10);
    
    try {
      // Gradual progress update
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 8, 85));
      }, 2000);
      
      console.log('[ConvertOpportunity] Starting conversion for opportunity:', oppId);
      
      const { data, error } = await supabase.functions.invoke('convert-opportunity-to-article', {
        body: { opportunityId: oppId, blogId }
      });
      
      clearInterval(progressInterval);
      
      if (error || !data?.success) {
        throw new Error(data?.error || 'Erro na conversão');
      }
      
      setGenerationProgress(100);
      toast.success('Artigo criado com sucesso!');
      
      console.log('[ConvertOpportunity] Success, redirecting to article:', data.article_id);
      
      // Redirect to the real editor with the created article
      navigate(`/client/articles/${data.article_id}/edit`, { replace: true });
    } catch (err) {
      console.error('[ConvertOpportunity] Error:', err);
      toast.error('Erro ao criar artigo. Tente novamente.');
      setPhase('form');
      setGenerationProgress(0);
      setGenerationStage(null);
    }
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
          whatsapp: (fullProfile as { whatsapp?: string })?.whatsapp || null
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
    if (
      quickMode && 
      blog?.id && 
      phase === 'form' && 
      !generationLockRef.current && 
      !autoGenerationTriggeredRef.current &&
      !articleId // Don't auto-generate when editing existing
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
          scheduledTime: null
        });
      }
    }
  }, [quickMode, fromOpportunityParam, themeParam, blog?.id, phase, articleId]);

  const loadExistingArticle = async (id: string) => {
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        toast.error('Artigo não encontrado');
        navigate('/client/articles');
        return;
      }

      // Populate state from existing article
      setExistingArticleId(data.id);
      setExistingArticleSlug(data.slug || null);
      setTitle(data.title || '');
      setContent(data.content || '');
      setExcerpt(data.excerpt || '');
      setMetaDescription(data.meta_description || '');
      setFaq(Array.isArray(data.faq) ? data.faq as unknown as Array<{ question: string; answer: string }> : []);
      setFeaturedImage(data.featured_image_url || null);
      setContentImages(Array.isArray(data.content_images) ? data.content_images as unknown as ContentImage[] : []);
      setPhase('editing'); // Go directly to editing mode

      console.log(`[Load Article] id=${id}, title="${data.title?.substring(0, 30)}...", hasImage=${!!data.featured_image_url}`);

      // =========================================================================
      // AUTO-DETECT MISSING IMAGES: Se o artigo tem conteúdo mas não tem imagem,
      // oferecer opção de gerar automaticamente
      // =========================================================================
      if (!data.featured_image_url && data.content && data.content.length > 200) {
        console.log(`[Load Article] Article ${id} has no images, prompting generation...`);
        toast.info('Este artigo não tem imagens. Use o botão "Gerar Imagens" para criar.', {
          duration: 5000,
          action: {
            label: 'Gerar Agora',
            onClick: () => {
              handleGenerateMissingImages(data.id, data.title, data.content);
            }
          }
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
      image_prompts: [] // Will be auto-generated by generate-image
    };
    
    await generateImagesWithArticleId(articleData, artId);
  };
  
  // Current article object for preview
  const articleForPreview: ArticleData | null = title ? {
    title,
    content,
    excerpt,
    meta_description: metaDescription,
    faq,
    featured_image_url: featuredImage,
    content_images: contentImages,
  } : null;

  const handleGenerate = async (formData: SimpleFormData) => {
    if (!blog?.id) {
      toast.error('Blog não encontrado. Recarregue a página.');
      return;
    }

    // ====================================================================
    // GENERATION LOCK: Prevent double-submission (Fast → Deep or vice-versa)
    // ====================================================================
    if (generationLockRef.current) {
      console.warn('[GUARD] Generation already in progress, blocking duplicate request');
      return;
    }
    generationLockRef.current = true;

    // ====================================================================
    // FINGERPRINT CHECK: Prevent duplicate articles with same title/theme
    // ====================================================================
    try {
      const flowResult = await ensureSingleArticle(blog.id, formData.theme);
      
      if (flowResult.action === 'update' && flowResult.articleId) {
        console.log(`[GUARD] Article already exists with id=${flowResult.articleId}, redirecting to edit`);
        toast.info('Artigo com este tema já existe. Abrindo para edição...');
        generationLockRef.current = false;
        navigate(`/client/articles/${flowResult.articleId}/edit`);
        return;
      }
    } catch (guardError) {
      console.error('[GUARD] Error checking for duplicates:', guardError);
      // Continue with generation on error
    }

    // Reset state
    setPhase('generating');
    setIsGenerating(true);
    setStreamingText('');
    setTitle('');
    setContent('');
    setExcerpt('');
    setMetaDescription('');
    setFaq([]);
    setFeaturedImage(null);
    setContentImages([]);
    setGenerationStage('analyzing');
    setGenerationProgress(0);

    // Determine if we should auto-publish based on schedule mode
    const shouldAutoPublish = formData.scheduleMode === 'now';
    const shouldGenerateImages = formData.generateImages;

    await streamArticle({
      theme: formData.theme,
      blogId: blog.id,
      generationMode: formData.generationMode,
      tone: 'friendly',
      autoPublish: shouldAutoPublish,
      onStage: (stage) => setGenerationStage(stage),
      onProgress: (percent) => setGenerationProgress(percent),
      onDelta: (text) => {
        setStreamingText((prev) => prev + text);
      },
      onDone: async (result) => {
        setIsGenerating(false);
        setGenerationStage(null);
        generationLockRef.current = false; // Release lock
        
        if (result) {
          // Populate editable state from generated article
          setTitle(result.title);
          setContent(result.content);
          setExcerpt(result.excerpt);
          setMetaDescription(result.meta_description);
          setFaq(result.faq || []);
          
          // ====================================================================
          // USE BACKEND-PERSISTED ARTICLE ID - DO NOT CREATE NEW ARTICLE!
          // The backend (generate-article-structured) already persisted the article
          // and returned { id, slug, status } in the response
          // ====================================================================
          const backendArticleId = (result as ArticleData & { id?: string }).id;
          
          if (backendArticleId) {
            setExistingArticleId(backendArticleId);
            console.log(`[BACKEND PERSISTED] Using backend article id=${backendArticleId} - NO frontend INSERT`);
            
            // ====================================================================
            // QUICK MODE REDIRECT: Redirect immediately to the real editor
            // ====================================================================
            if (quickMode) {
              toast.success('Artigo criado! Redirecionando...');
              
              // Generate images in background if enabled
              if (shouldGenerateImages) {
                // Don't await - let it run in background
                generateImagesWithArticleId(result, backendArticleId).catch(console.error);
              }
              
              navigate(`/client/articles/${backendArticleId}/edit`, { replace: true });
              return;
            }
            
            // ====================================================================
            // HANDLE SCHEDULING: If user chose to schedule, update the article
            // ====================================================================
            if (formData.scheduleMode === 'scheduled' && formData.scheduledDate) {
              try {
                // Combine date and time
                const [hours, minutes] = (formData.scheduledTime || '09:00').split(':').map(Number);
                const scheduledAt = new Date(formData.scheduledDate);
                scheduledAt.setHours(hours, minutes, 0, 0);
                
                await supabase
                  .from('articles')
                  .update({
                    status: 'scheduled',
                    scheduled_at: scheduledAt.toISOString(),
                    published_at: null
                  })
                  .eq('id', backendArticleId);
                
                console.log(`[SCHEDULED] Article scheduled for ${scheduledAt.toISOString()}`);
                toast.success(`Artigo agendado para ${scheduledAt.toLocaleDateString('pt-BR')} às ${formData.scheduledTime}!`);
              } catch (scheduleError) {
                console.error('[SCHEDULE ERROR]', scheduleError);
                toast.error('Erro ao agendar artigo');
              }
            } else {
              toast.success(shouldAutoPublish ? 'Artigo publicado!' : 'Artigo gerado!');
            }
            
            setPhase('editing');
            
            // Generate images only if enabled
            if (shouldGenerateImages) {
              toast.info('Gerando imagens...');
              await generateImagesWithArticleId(result, backendArticleId);
            } else {
              console.log('[SKIP IMAGES] User disabled image generation');
            }
          } else {
            // Fallback: Backend didn't return ID (shouldn't happen in normal flow)
            console.warn('[FALLBACK] Backend did not return article id, generating images without persistence');
            setPhase('editing');
            toast.warning('Artigo gerado, mas imagens serão salvas apenas ao publicar');
            if (shouldGenerateImages) {
              await generateImages(result);
            }
          }
        }
      },
      onError: (error) => {
        setIsGenerating(false);
        setGenerationStage(null);
        setPhase('form');
        generationLockRef.current = false; // Release lock on error
        toast.error(error || 'Erro ao gerar artigo');
      },
    });
  };

  const generateImages = async (articleData: ArticleData) => {
    if (!blog?.id) return;
    
    setIsGeneratingImages(true);
    const totalImages = 4; // 1 cover + 3 internal
    
    try {
      // Get current user for cost tracking
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // Generate featured image
      setImageProgress({ current: 1, total: totalImages, currentContext: 'Imagem de capa' });
      
      const { data: coverResult, error: coverError } = await supabase.functions.invoke('generate-image', {
        body: {
          articleTitle: articleData.title,
          articleTheme: articleData.title,
          context: 'cover',
          blog_id: blog.id,
          article_id: existingArticleId, // If editing, persist directly
          user_id: currentUser?.id, // ✅ CRITICAL: Pass user_id for cost logging
        }
      });
      
      if (!coverError) {
        // Prefer publicUrl from storage, fallback to base64
        let coverUrl = coverResult?.publicUrl || null;
        
        if (!coverUrl && coverResult?.imageBase64) {
          // Fallback: upload manually if edge function didn't
          const fileName = `cover-${existingArticleId || Date.now()}.png`;
          coverUrl = await uploadImageToStorage(coverResult.imageBase64, fileName);
        }
        
        if (coverUrl) {
          setFeaturedImage(coverUrl);
          console.log('[generateImages] Cover image URL:', coverUrl);
          
          // If we have an existing article but edge function didn't persist, do it now
          if (existingArticleId && !coverResult?.publicUrl) {
            await updateArticleImage(existingArticleId, 'cover', coverUrl);
          }
        }
      }
      
      // Generate content images from prompts
      const imagePrompts = articleData.image_prompts || [];
      const newContentImages: ContentImage[] = [];
      
      for (let i = 0; i < Math.min(imagePrompts.length, 3); i++) {
        const prompt = imagePrompts[i];
        setImageProgress({ 
          current: i + 2, 
          total: totalImages, 
          currentContext: prompt.context || `Imagem ${i + 1}` 
        });
        
        const { data: imgResult, error: imgError } = await supabase.functions.invoke('generate-image', {
          body: {
            prompt: prompt.prompt,
            context: prompt.context,
            articleTitle: articleData.title,
            articleTheme: articleData.title,
            blog_id: blog.id,
            article_id: existingArticleId, // CRITICAL: Pass article_id for persistence
            user_id: currentUser?.id, // ✅ CRITICAL: Pass user_id for cost logging
          }
        });
        
        if (!imgError) {
          let imgUrl = imgResult?.publicUrl || null;
          
          if (!imgUrl && imgResult?.imageBase64) {
            // Fallback: upload manually
            const fileName = `${prompt.context}-${Date.now()}.png`;
            imgUrl = await uploadImageToStorage(imgResult.imageBase64, fileName);
          }
          
          if (imgUrl) {
            newContentImages.push({
              context: prompt.context,
              url: imgUrl,
              after_section: prompt.after_section
            });
          }
        }
      }
      
      setContentImages(newContentImages);
      
      // Persist content images if we have an existing article
      if (existingArticleId && newContentImages.length > 0) {
        await updateArticleImage(existingArticleId, 'content', '', newContentImages);
      }
      
      const totalGenerated = newContentImages.length + (featuredImage ? 1 : 0);
      toast.success(`${totalGenerated} imagens geradas e salvas!`);
      
    } catch (error) {
      console.error('Error generating images:', error);
      toast.error('Erro ao gerar algumas imagens');
    } finally {
      setIsGeneratingImages(false);
      setImageProgress(null);
    }
  };

  // Dedicated function for generating images with a known article_id
  const generateImagesWithArticleId = async (articleData: ArticleData, articleId: string) => {
    if (!blog?.id) return;
    
    setIsGeneratingImages(true);
    const totalImages = 4; // 1 cover + 3 internal
    
    try {
      // Get current user for cost tracking
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      // Generate featured image
      setImageProgress({ current: 1, total: totalImages, currentContext: 'Imagem de capa' });
      
      const { data: coverResult, error: coverError } = await supabase.functions.invoke('generate-image', {
        body: {
          articleTitle: articleData.title,
          articleTheme: articleData.title,
          context: 'cover',
          blog_id: blog.id,
          article_id: articleId, // Use passed article_id for persistence
          user_id: currentUser?.id, // ✅ CRITICAL: Pass user_id for cost logging
        }
      });
      
      if (!coverError) {
        let coverUrl = coverResult?.publicUrl || null;
        
        if (!coverUrl && coverResult?.imageBase64) {
          const fileName = `cover-${articleId}-${Date.now()}.png`;
          coverUrl = await uploadImageToStorage(coverResult.imageBase64, fileName);
          
          // Persist manually if edge function didn't
          if (coverUrl) {
            await updateArticleImage(articleId, 'cover', coverUrl);
          }
        }
        
        if (coverUrl) {
          setFeaturedImage(coverUrl);
          console.log('[generateImagesWithArticleId] Cover image persisted:', coverUrl);
        }
      }
      
      // Generate content images from prompts
      const imagePrompts = articleData.image_prompts || [];
      const newContentImages: ContentImage[] = [];
      
      for (let i = 0; i < Math.min(imagePrompts.length, 3); i++) {
        const prompt = imagePrompts[i];
        setImageProgress({ 
          current: i + 2, 
          total: totalImages, 
          currentContext: prompt.context || `Imagem ${i + 1}` 
        });
        
        const { data: imgResult, error: imgError } = await supabase.functions.invoke('generate-image', {
          body: {
            prompt: prompt.prompt,
            context: prompt.context,
            articleTitle: articleData.title,
            articleTheme: articleData.title,
            blog_id: blog.id,
            article_id: articleId, // Use passed article_id for persistence
            user_id: currentUser?.id, // ✅ CRITICAL: Pass user_id for cost logging
          }
        });
        
        if (!imgError) {
          let imgUrl = imgResult?.publicUrl || null;
          
          if (!imgUrl && imgResult?.imageBase64) {
            const fileName = `${prompt.context}-${articleId}-${Date.now()}.png`;
            imgUrl = await uploadImageToStorage(imgResult.imageBase64, fileName);
          }
          
          if (imgUrl) {
            newContentImages.push({
              context: prompt.context,
              url: imgUrl,
              after_section: prompt.after_section
            });
          }
        }
      }
      
      setContentImages(newContentImages);
      
      // Content images are already persisted by edge function when article_id is passed
      // But fallback persist if needed
      if (newContentImages.length > 0) {
        await updateArticleImage(articleId, 'content', '', newContentImages);
      }
      
      const totalGenerated = newContentImages.length + (coverResult?.publicUrl ? 1 : 0);
      toast.success(`${totalGenerated > 0 ? totalGenerated : 'Todas'} imagens geradas e salvas!`);
      
    } catch (error) {
      console.error('Error generating images:', error);
      toast.error('Erro ao gerar algumas imagens');
    } finally {
      setIsGeneratingImages(false);
      setImageProgress(null);
    }
  };

  const regenerateImage = async (type: 'cover' | 'internal', index?: number) => {
    if (!title) return;
    
    setIsGeneratingImages(true);
    try {
      // Get current user for cost tracking
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (type === 'cover') {
        setImageProgress({ current: 1, total: 1, currentContext: 'Regenerando capa' });
        
        const { data, error } = await supabase.functions.invoke('generate-image', {
          body: {
            articleTitle: title,
            articleTheme: title,
            context: 'cover',
            blog_id: blog?.id,
            article_id: existingArticleId, // Persist directly if editing
            user_id: currentUser?.id, // ✅ CRITICAL: Pass user_id for cost logging
            forceRegenerate: true, // ✅ Bypass cache for regeneration
          }
        });
        
        if (!error) {
          let coverUrl = data?.publicUrl || null;
          
          if (!coverUrl && data?.imageBase64) {
            const fileName = `cover-${existingArticleId || Date.now()}.png`;
            coverUrl = await uploadImageToStorage(data.imageBase64, fileName);
          }
          
          if (coverUrl) {
            setFeaturedImage(coverUrl);
            
            // Persist if edge function didn't
            if (existingArticleId && !data?.publicUrl) {
              await updateArticleImage(existingArticleId, 'cover', coverUrl);
            }
            
            toast.success('Imagem de capa regenerada!');
          }
        }
      } else if (typeof index === 'number' && contentImages[index]) {
        const img = contentImages[index];
        setImageProgress({ current: 1, total: 1, currentContext: `Regenerando: ${img.context}` });
        
        const { data, error } = await supabase.functions.invoke('generate-image', {
          body: {
            context: img.context,
            articleTitle: title,
            articleTheme: title,
            blog_id: blog?.id,
            user_id: currentUser?.id, // ✅ CRITICAL: Pass user_id for cost logging
            forceRegenerate: true, // ✅ Bypass cache for regeneration
          }
        });
        
        if (!error) {
          let imgUrl = data?.publicUrl || null;
          
          if (!imgUrl && data?.imageBase64) {
            const fileName = `${img.context}-${Date.now()}.png`;
            imgUrl = await uploadImageToStorage(data.imageBase64, fileName);
          }
          
          if (imgUrl) {
            const newImages = [...contentImages];
            newImages[index] = { ...img, url: imgUrl };
            setContentImages(newImages);
            
            // Persist content images
            if (existingArticleId) {
              await updateArticleImage(existingArticleId, 'content', '', newImages);
            }
            
            toast.success('Imagem regenerada!');
          }
        }
      }
    } catch (error) {
      console.error('Error regenerating image:', error);
      toast.error('Erro ao regenerar imagem');
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
      // Cast content_images to Json type for Supabase compatibility
      const contentImagesJson = contentImages.length > 0 
        ? contentImages.map(img => ({ context: img.context, url: img.url, after_section: img.after_section }))
        : null;

      // If editing existing article, UPDATE instead of INSERT
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

        const { error } = await supabase
          .from('articles')
          .update(updateData)
          .eq('id', existingArticleId);

        if (error) throw error;

        console.log(`[UPDATE Article] id=${existingArticleId}, publish=${publish}`);
        toast.success(publish ? 'Artigo publicado!' : 'Alterações salvas!');
        navigate('/client/articles');
        return;
      }

      // REGRA DE OURO: Verificar se artigo com mesmo título já existe antes de INSERT
      const { data: existingByTitle } = await supabase
        .from('articles')
        .select('id')
        .eq('blog_id', blog.id)
        .ilike('title', title.trim().toLowerCase())
        .maybeSingle();

      if (existingByTitle) {
        console.warn(`[GUARD] Article with same title exists, using UPDATE instead of INSERT. id=${existingByTitle.id}`);
        
        // Usar UPDATE no artigo existente
        const updateData = {
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

        const { error } = await supabase
          .from('articles')
          .update(updateData)
          .eq('id', existingByTitle.id);

        if (error) throw error;

        console.log(`[UPDATE Article] id=${existingByTitle.id}, prevented duplicate, publish=${publish}`);
        toast.success(publish ? 'Artigo publicado!' : 'Alterações salvas!');
        navigate('/client/articles');
        return;
      }

      // CREATE new article (nenhum duplicado encontrado)
      const slug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const articleData = {
        blog_id: blog.id,
        title: title.trim(),
        slug: `${slug}-${Date.now()}`,
        content: content.trim(),
        excerpt: excerpt.trim(),
        meta_description: metaDescription.trim(),
        faq: faq.length > 0 ? faq : null,
        featured_image_url: featuredImage,
        content_images: contentImagesJson as unknown as null,
        status: publish ? 'published' : 'draft',
        published_at: publish ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from('articles')
        .insert([articleData]);

      if (error) throw error;

      console.log(`[INSERT Article] title="${title.substring(0, 30)}...", publish=${publish}`);
      toast.success(
        publish 
          ? 'Artigo publicado com sucesso!' 
          : 'Rascunho salvo com sucesso!'
      );
      
      navigate('/client/dashboard');
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
      // Fetch business profile for context (if available) - including whatsapp for CTA
      let fetchedBusinessProfile = null;
      if (blog?.id) {
        const { data: profileData } = await supabase
          .from('business_profile')
          .select('company_name, niche, tone_of_voice, country')
          .eq('blog_id', blog.id)
          .single();
        
        if (profileData) {
          // Get whatsapp separately since it's a new column
          const { data: fullProfile } = await supabase
            .from('business_profile')
            .select('*')
            .eq('blog_id', blog.id)
            .maybeSingle();
          
          fetchedBusinessProfile = {
            ...profileData,
            whatsapp: (fullProfile as { whatsapp?: string })?.whatsapp
          };
        }
      }

      const response = await supabase.functions.invoke('improve-article-complete', {
        body: {
          content,
          title,
          metaDescription,
          keywords: [],
          businessProfile: fetchedBusinessProfile ? {
            company_name: fetchedBusinessProfile.company_name,
            niche: fetchedBusinessProfile.niche,
            tone_of_voice: fetchedBusinessProfile.tone_of_voice,
            country: fetchedBusinessProfile.country,
            whatsapp: fetchedBusinessProfile.whatsapp
          } : undefined
        }
      });

      if (response.error) throw new Error(response.error.message);

      const { improvedContent, improvements, stats } = response.data;

      if (stats.totalImprovements > 0) {
        // Store original content and results
        setImproveResults({
          improvements,
          stats,
          improvedContent,
          originalContent: content
        });

        // Apply improvements
        setContent(improvedContent);
        setShowImproveDialog(true);
        
        toast.success(`${stats.totalImprovements} melhorias aplicadas!`);
      } else {
        toast.success('Artigo já otimizado! Nenhuma melhoria necessária.');
      }
    } catch (error) {
      console.error('Error improving article:', error);
      toast.error('Erro ao melhorar artigo', {
        description: error instanceof Error ? error.message : 'Erro desconhecido'
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
        <Input
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          placeholder="Breve resumo do artigo"
        />
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
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Imagem de Capa</label>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => regenerateImage('cover')}
              disabled={isGeneratingImages}
              className="h-7 text-xs gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Regenerar
            </Button>
          </div>
          <div className="relative rounded-lg overflow-hidden border border-border">
            <img 
              src={featuredImage} 
              alt="Featured" 
              className="w-full h-32 object-cover"
            />
          </div>
        </div>
      )}
      
      {/* Content Images */}
      {contentImages.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Imagens do Conteúdo</label>
          <div className="grid grid-cols-3 gap-2">
            {contentImages.map((img, idx) => (
              <div key={idx} className="relative group rounded-lg overflow-hidden border border-border">
                <img src={img.url} alt={img.context} className="w-full h-20 object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => regenerateImage('internal', idx)}
                    disabled={isGeneratingImages}
                    className="h-7 text-xs text-white hover:bg-white/20"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                  <p className="text-[10px] text-white truncate">{img.context}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* CTA Preview - shows how the final CTA will look */}
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
          <RichTextEditor
            value={content}
            onChange={setContent}
            placeholder="Edite o conteúdo do artigo..."
          />
        </div>
      </div>
    </div>
  );

  // Render preview content
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
          status: 'generating'
        } : null}
      />
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between pb-4 border-b border-border mb-6">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/client/dashboard')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          
          {phase === 'editing' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleNewArticle}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Artigo
            </Button>
          )}
        </div>
        
        {phase === 'editing' && (
          <div className="flex items-center gap-2">
            {/* View Mode Tabs */}
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
            
            {/* AI Improve Button */}
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
                  Melhorar com IA
                </>
              )}
            </Button>
            
            {/* Generate Images Button - Show when no featured image */}
            {!featuredImage && content && content.length > 100 && existingArticleId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleGenerateMissingImages(existingArticleId, title, content)}
                disabled={isGeneratingImages}
                className="gap-2 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10"
              >
                {isGeneratingImages ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-4 w-4" />
                    Gerar Imagens
                  </>
                )}
              </Button>
            )}
            
            {/* View on Site Button - Show when article is saved and has a slug */}
            {existingArticleId && existingArticleSlug && blog && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = getCanonicalArticleUrl(blog, existingArticleSlug);
                  window.open(url, '_blank');
                }}
                className="gap-2 border-blue-500/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10"
              >
                <ExternalLink className="h-4 w-4" />
                Ver no site
              </Button>
            )}
            
            {/* PDF Download Button */}
            {existingArticleId && title && (
              <ArticlePdfDownload
                articleId={existingArticleId}
                articleTitle={title}
                variant="compact"
              />
            )}
            
            {/* SERP Score Panel Toggle (Desktop) - Always visible in editing phase */}
            {phase === 'editing' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowScorePanelDesktop(prev => !prev)}
                className="hidden md:flex gap-2 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
              >
                {showScorePanelDesktop ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    <span className="text-xs">Ocultar Score</span>
                  </>
                ) : (
                  <>
                    <BarChart3 className="h-4 w-4" />
                    <span className="text-xs">Mostrar Score</span>
                  </>
                )}
              </Button>
            )}
            
            {/* SERP Score Panel Toggle (Mobile) */}
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
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Rascunho
            </Button>
            
            <Button
              size="sm"
              onClick={() => handleSave(true)}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Publicar
            </Button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        {phase === 'form' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full min-h-0">
            <SimpleArticleForm 
              onGenerate={handleGenerate} 
              isGenerating={isGenerating}
            />
            <Card className="h-full flex items-center justify-center bg-muted/30 border-dashed">
              <CardContent className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-muted-foreground">Preview do Artigo</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  O artigo aparecerá aqui enquanto é gerado
                </p>
              </CardContent>
            </Card>
          </div>
        )}
        
        {phase === 'generating' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  Gerando Artigo...
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-center">
                <GenerationProgress 
                  stage={generationStage} 
                  progress={generationProgress}
                  isActive={isGenerating}
                />
              </CardContent>
            </Card>
            <ArticlePreview
              article={null}
              streamingText={streamingText}
              isStreaming={isGenerating}
            />
          </div>
        )}
        
        {phase === 'editing' && (
          <>
            {/* Mobile: Always show editor */}
            <div className="md:hidden h-full overflow-auto">
              {renderEditor()}
            </div>
            
            {/* Desktop: Based on view mode */}
            <div className="hidden md:block h-full">
              {viewMode === 'editor' && (
                <div className={cn(
                  "grid gap-4 h-full transition-all duration-300",
                  showScorePanelDesktop 
                    ? "grid-cols-[1fr_320px]" 
                    : "grid-cols-1"
                )}>
                  <div className="overflow-auto">
                    {renderEditor()}
                  </div>
                  
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
                <div className={cn(
                  "grid gap-4 h-full transition-all duration-300",
                  showScorePanelDesktop 
                    ? "grid-cols-[1fr_320px]" 
                    : "grid-cols-1"
                )}>
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
                <div className={cn(
                  "grid gap-4 h-full transition-all duration-300",
                  showScorePanelDesktop 
                    ? "grid-cols-[1fr_1fr_320px]" 
                    : "grid-cols-[1fr_1fr]"
                )}>
                  <div className="overflow-auto">
                    {renderEditor()}
                  </div>
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
