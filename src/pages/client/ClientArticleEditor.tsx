import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBlog } from '@/hooks/useBlog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { streamArticle, type ArticleData, type GenerationStage } from '@/utils/streamArticle';
import { SimpleArticleForm, type SimpleFormData } from '@/components/client/SimpleArticleForm';
import { ArticlePreview } from '@/components/ArticlePreview';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { GenerationProgress } from '@/components/seo/GenerationProgress';
import { ImproveArticleDialog } from '@/components/editor/ImproveArticleDialog';
import { extractImageUrl, uploadImageToStorage, updateArticleImage } from '@/utils/imageUtils';
import { 
  ArrowLeft, 
  Save, 
  Send, 
  Loader2, 
  FileText,
  Plus,
  Edit3,
  Eye,
  Columns,
  Sparkles,
  Image as ImageIcon,
  RefreshCw
} from 'lucide-react';

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
  const { blog, loading: blogLoading } = useBlog();
  
  // Track if we're editing an existing article
  const [existingArticleId, setExistingArticleId] = useState<string | null>(null);
  
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
  
  // Save state
  const [isSaving, setIsSaving] = useState(false);
  
  // Improve with AI state
  const [isImprovingArticle, setIsImprovingArticle] = useState(false);
  const [showImproveDialog, setShowImproveDialog] = useState(false);
  const [improveResults, setImproveResults] = useState<{
    improvements: { type: 'paragraph' | 'visual_block' | 'seo' | 'cta'; description: string; location?: string }[];
    stats: { addedVisualBlocks: number; fixedParagraphs: number; seoIssues: number; totalImprovements: number };
    improvedContent: string;
    originalContent: string;
  } | null>(null);
  
  // Persist view mode
  useEffect(() => {
    localStorage.setItem('article-editor-view-mode', viewMode);
  }, [viewMode]);

  // Load existing article if editing
  useEffect(() => {
    if (articleId && blog?.id) {
      loadExistingArticle(articleId);
    }
  }, [articleId, blog?.id]);

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
      setTitle(data.title || '');
      setContent(data.content || '');
      setExcerpt(data.excerpt || '');
      setMetaDescription(data.meta_description || '');
      setFaq(Array.isArray(data.faq) ? data.faq as unknown as Array<{ question: string; answer: string }> : []);
      setFeaturedImage(data.featured_image_url || null);
      setContentImages(Array.isArray(data.content_images) ? data.content_images as unknown as ContentImage[] : []);
      setPhase('editing'); // Go directly to editing mode

      console.log(`[Load Article] id=${id}, title="${data.title?.substring(0, 30)}..."`);
    } catch (err) {
      console.error('Error loading article:', err);
      toast.error('Erro ao carregar artigo');
    }
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

    await streamArticle({
      theme: formData.theme,
      blogId: blog.id,
      generationMode: formData.generationMode,
      tone: 'friendly',
      autoPublish: false,
      onStage: (stage) => setGenerationStage(stage),
      onProgress: (percent) => setGenerationProgress(percent),
      onDelta: (text) => {
        setStreamingText((prev) => prev + text);
      },
      onDone: async (result) => {
        setIsGenerating(false);
        setGenerationStage(null);
        
        if (result) {
          // Populate editable state from generated article
          setTitle(result.title);
          setContent(result.content);
          setExcerpt(result.excerpt);
          setMetaDescription(result.meta_description);
          setFaq(result.faq || []);
          
          // CRITICAL: Save article as draft BEFORE generating images
          // This ensures we have an article_id for image persistence
          const slug = result.title
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          
          try {
            const { data: newArticle, error: insertError } = await supabase
              .from('articles')
              .insert([{
                blog_id: blog.id,
                title: result.title,
                slug: `${slug}-${Date.now()}`,
                content: result.content,
                excerpt: result.excerpt,
                meta_description: result.meta_description,
                faq: result.faq || null,
                status: 'draft',
              }])
              .select('id')
              .single();
            
            if (!insertError && newArticle) {
              setExistingArticleId(newArticle.id);
              console.log(`[Draft Created] id=${newArticle.id} - images will persist to this article`);
              
              setPhase('editing');
              toast.success('Artigo salvo como rascunho! Gerando imagens...');
              
              // Generate images with valid article_id for persistence
              await generateImagesWithArticleId(result, newArticle.id);
            } else {
              console.error('[Draft Creation Failed]', insertError);
              setPhase('editing');
              toast.warning('Artigo gerado, mas imagens serão salvas apenas ao publicar');
              await generateImages(result);
            }
          } catch (draftError) {
            console.error('[Draft Error]', draftError);
            setPhase('editing');
            await generateImages(result);
          }
        }
      },
      onError: (error) => {
        setIsGenerating(false);
        setGenerationStage(null);
        setPhase('form');
        toast.error(error || 'Erro ao gerar artigo');
      },
    });
  };

  const generateImages = async (articleData: ArticleData) => {
    if (!blog?.id) return;
    
    setIsGeneratingImages(true);
    const totalImages = 4; // 1 cover + 3 internal
    
    try {
      // Generate featured image
      setImageProgress({ current: 1, total: totalImages, currentContext: 'Imagem de capa' });
      
      const { data: coverResult, error: coverError } = await supabase.functions.invoke('generate-image', {
        body: {
          articleTitle: articleData.title,
          articleTheme: articleData.title,
          context: 'cover',
          blog_id: blog.id,
          article_id: existingArticleId, // If editing, persist directly
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
      // Generate featured image
      setImageProgress({ current: 1, total: totalImages, currentContext: 'Imagem de capa' });
      
      const { data: coverResult, error: coverError } = await supabase.functions.invoke('generate-image', {
        body: {
          articleTitle: articleData.title,
          articleTheme: articleData.title,
          context: 'cover',
          blog_id: blog.id,
          article_id: articleId, // Use passed article_id for persistence
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
      if (type === 'cover') {
        setImageProgress({ current: 1, total: 1, currentContext: 'Regenerando capa' });
        
        const { data, error } = await supabase.functions.invoke('generate-image', {
          body: {
            articleTitle: title,
            articleTheme: title,
            context: 'cover',
            blog_id: blog?.id,
            article_id: existingArticleId, // Persist directly if editing
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

      // CREATE new article
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
      // Fetch business profile for context (if available)
      let businessProfile = null;
      if (blog?.id) {
        const { data: profileData } = await supabase
          .from('business_profile')
          .select('company_name, niche, tone_of_voice')
          .eq('blog_id', blog.id)
          .single();
        
        if (profileData) {
          businessProfile = profileData;
        }
      }

      const response = await supabase.functions.invoke('improve-article-complete', {
        body: {
          content,
          title,
          metaDescription,
          keywords: [],
          businessProfile: businessProfile ? {
            company_name: businessProfile.company_name,
            niche: businessProfile.niche,
            tone_of_voice: businessProfile.tone_of_voice
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
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
                <div className="h-full overflow-auto">
                  {renderEditor()}
                </div>
              )}
              
              {viewMode === 'preview' && renderPreview()}
              
              {viewMode === 'split' && (
                <div className="grid grid-cols-2 gap-6 h-full">
                  <div className="overflow-auto">
                    {renderEditor()}
                  </div>
                  {renderPreview()}
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
