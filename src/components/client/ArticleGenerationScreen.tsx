import { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getArticleUrl } from '@/utils/blogUrl';
import { GenerationStepList, GenerationStep } from './GenerationStepList';
import { LiveArticlePreview } from './LiveArticlePreview';
import { GenerationSuccessScreen } from './GenerationSuccessScreen';
import { streamArticle, GenerationStage, ArticleData } from '@/utils/streamArticle';

interface Blog {
  id: string;
  name: string;
  slug: string;
  platform_subdomain?: string | null;
  custom_domain?: string | null;
}

interface CreatedArticle {
  id: string;
  title: string;
  slug: string;
}

interface ArticleGenerationScreenProps {
  topic: string;
  blog: Blog;
  onComplete: (article: CreatedArticle) => void;
  onCancel: () => void;
}

// Map backend stages to UI steps
const mapStageToStep = (stage: GenerationStage): GenerationStep => {
  switch (stage) {
    case 'analyzing':
      return 'analyzing';
    case 'structuring':
      return 'structuring';
    case 'generating':
      return 'generating';
    case 'finalizing':
      return 'publishing';
    default:
      return 'analyzing';
  }
};

export function ArticleGenerationScreen({
  topic,
  blog,
  onComplete,
  onCancel,
}: ArticleGenerationScreenProps) {
  const [currentStep, setCurrentStep] = useState<GenerationStep>('analyzing');
  const [progress, setProgress] = useState(0);
  const [streamingTitle, setStreamingTitle] = useState('');
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [createdArticle, setCreatedArticle] = useState<CreatedArticle | null>(null);
  
  // Ref to track mounted state
  const isMountedRef = useRef(true);

  // Calculate article URL
  const articleUrl = createdArticle ? getArticleUrl(blog, createdArticle.slug) : '';

  // Run generation on mount using streamArticle
  useEffect(() => {
    isMountedRef.current = true;

    const runGeneration = async () => {
      console.log('ArticleGenerationScreen: Starting generation with streamArticle', {
        topic,
        blogId: blog.id,
      });

      await streamArticle({
        theme: topic,
        blogId: blog.id,
        tone: 'friendly',
        source: 'form',
        funnelMode: 'top',
        articleGoal: 'educar',
        generationMode: 'deep',

        onStage: (stage) => {
          if (!isMountedRef.current) return;
          
          if (stage) {
            const uiStep = mapStageToStep(stage);
            console.log('ArticleGenerationScreen: Stage changed', { stage, uiStep });
            setCurrentStep(uiStep);
          }
        },

        onDelta: (text) => {
          if (!isMountedRef.current) return;
          setStreamingContent(prev => prev + text);
        },

        onProgress: (percent) => {
          if (!isMountedRef.current) return;
          setProgress(percent);
          
          // Update visual steps based on progress
          if (percent > 50 && percent <= 65) {
            setCurrentStep('seo');
          } else if (percent > 65 && percent <= 80) {
            setCurrentStep('rhythm');
          } else if (percent > 80 && percent <= 95) {
            setCurrentStep('images');
          }
        },

        onDone: async (article: ArticleData | null) => {
          if (!isMountedRef.current) return;

          if (!article) {
            setError('Artigo não foi gerado');
            return;
          }

          console.log('ArticleGenerationScreen: Article received, verifying persistence', article);
          
          // Set the title immediately
          setStreamingTitle(article.title);
          setCurrentStep('publishing');
          setProgress(90);

          // CRITICAL: Verify article is saved in database
          if (!article.id) {
            console.error('ArticleGenerationScreen: No article ID returned');
            setError('Artigo não possui ID válido');
            return;
          }

          let verified = false;
          let attempts = 0;
          const maxAttempts = 15;
          let savedArticle: { id: string; title: string; slug: string; status: string | null } | null = null;

          while (!verified && attempts < maxAttempts && isMountedRef.current) {
            attempts++;
            
            const { data, error: verifyError } = await supabase
              .from('articles')
              .select('id, title, slug, status')
              .eq('id', article.id)
              .single();

            if (data && data.status === 'published' && data.slug) {
              verified = true;
              savedArticle = data;
              console.log('ArticleGenerationScreen: Article verified in database', data);
            } else {
              console.log('ArticleGenerationScreen: Waiting for article persistence...', { 
                attempt: attempts, 
                data,
                error: verifyError 
              });
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }

          if (!isMountedRef.current) return;

          if (verified && savedArticle) {
            setProgress(100);
            setCreatedArticle({
              id: savedArticle.id,
              title: savedArticle.title,
              slug: savedArticle.slug,
            });
            setIsComplete(true);
          } else if (article.slug) {
            // Fallback: use API response if verification times out but we have slug
            console.warn('ArticleGenerationScreen: Verification timeout, using API response');
            setProgress(100);
            setCreatedArticle({
              id: article.id!,
              title: article.title,
              slug: article.slug,
            });
            setIsComplete(true);
          } else {
            setError('Não foi possível confirmar a publicação do artigo. Tente novamente.');
          }
        },

        onError: (err) => {
          if (!isMountedRef.current) return;
          console.error('ArticleGenerationScreen: Error', err);
          setError(err);
        },
      });
    };

    runGeneration();

    return () => {
      isMountedRef.current = false;
    };
  }, [topic, blog.id]);

  // Handle view article
  const handleViewArticle = () => {
    if (articleUrl) {
      window.open(articleUrl, '_blank');
    }
  };

  // Handle create another
  const handleCreateAnother = () => {
    onCancel();
  };

  // Show success screen when complete
  if (isComplete && createdArticle) {
    return (
      <GenerationSuccessScreen
        title={createdArticle.title}
        url={articleUrl}
        onViewArticle={handleViewArticle}
        onCreateAnother={handleCreateAnother}
        onGoHome={() => onComplete(createdArticle)}
      />
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-destructive/5">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Erro na Geração</h2>
            <p className="text-muted-foreground">{error}</p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={onCancel}>
              Tentar Novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/95 backdrop-blur">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Gerando Artigo</h1>
          <p className="text-sm text-muted-foreground">"{topic}"</p>
        </div>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onCancel}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Main Content - Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Progress */}
        <div className="w-full md:w-[400px] lg:w-[450px] border-r border-border p-6 overflow-y-auto bg-muted/20">
          <GenerationStepList currentStep={currentStep} progress={progress} />
        </div>

        {/* Right Panel - Live Preview */}
        <div className="hidden md:flex flex-1 p-6 bg-background">
          <LiveArticlePreview 
            title={streamingTitle}
            content={streamingContent}
            isGenerating={currentStep !== 'complete' && !isComplete}
          />
        </div>
      </div>
    </div>
  );
}
