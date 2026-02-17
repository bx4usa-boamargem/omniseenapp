import { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertCircle, RefreshCw, RotateCcw } from 'lucide-react';
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

// Error types for better UX
type ErrorType = 'generation' | 'persistence' | 'validation' | 'unknown';

interface GenerationError {
  type: ErrorType;
  message: string;
  canRetry: boolean;
  hasContent: boolean;
}

// Map backend stages to UI steps
const mapStageToStep = (stage: GenerationStage): GenerationStep => {
  switch (stage) {
    case 'analyzing':
      return 'analyzing';
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
  const [error, setError] = useState<GenerationError | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [createdArticle, setCreatedArticle] = useState<CreatedArticle | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Store the last generated article data for retry
  const lastArticleDataRef = useRef<ArticleData | null>(null);
  
  // Ref to track mounted state
  const isMountedRef = useRef(true);

  // Calculate article URL
  const articleUrl = createdArticle ? getArticleUrl(blog, createdArticle.slug) : '';

  // Classify error type for better UX
  const classifyError = (errorMessage: string, hasContent: boolean): GenerationError => {
    const lowerError = errorMessage.toLowerCase();
    
    if (lowerError.includes('db_persist') || lowerError.includes('persistência') || lowerError.includes('salvar')) {
      return {
        type: 'persistence',
        message: 'O artigo foi gerado, mas houve um erro ao salvá-lo. Você pode tentar publicar novamente.',
        canRetry: true,
        hasContent,
      };
    }
    
    if (lowerError.includes('id válido') || lowerError.includes('não encontrado') || lowerError.includes('verificação')) {
      return {
        type: 'validation',
        message: 'Não foi possível confirmar a publicação do artigo. Tente novamente.',
        canRetry: true,
        hasContent,
      };
    }
    
    if (lowerError.includes('ai_') || lowerError.includes('geração') || lowerError.includes('generate')) {
      return {
        type: 'generation',
        message: errorMessage,
        canRetry: true,
        hasContent: false,
      };
    }
    
    return {
      type: 'unknown',
      message: errorMessage,
      canRetry: true,
      hasContent,
    };
  };

  // Main generation function
  const runGeneration = useCallback(async () => {
    console.log('ArticleGenerationScreen: Starting generation with streamArticle', {
      topic,
      blogId: blog.id,
    });

    // Reset states for new generation
    setError(null);
    setCurrentStep('analyzing');
    setProgress(0);

    await streamArticle({
      theme: topic,
      blogId: blog.id,
      tone: 'friendly',
      source: 'form',
      funnelMode: 'top',
      articleGoal: 'educar',
      generationMode: 'deep',
      autoPublish: true, // Sempre auto-publica no fluxo de subconta

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
          setError(classifyError('Artigo não foi gerado', false));
          return;
        }

        console.log('ArticleGenerationScreen: Article received from backend', {
          id: article.id,
          slug: article.slug,
          status: article.status,
          title: article.title,
        });
        
        // Store for potential retry
        lastArticleDataRef.current = article;
        
        // Set the title immediately
        setStreamingTitle(article.title);
        setCurrentStep('publishing');
        setProgress(90);

        // REGRA CRÍTICA: Verificar se o backend retornou id, slug e status
        if (!article.id) {
          console.error('ArticleGenerationScreen: No article ID returned from backend');
          setError(classifyError('Artigo não possui ID válido. O backend pode não ter persistido corretamente.', true));
          return;
        }

        if (!article.slug) {
          console.error('ArticleGenerationScreen: No article slug returned from backend');
          setError(classifyError('Artigo não possui slug válido.', true));
          return;
        }

        // Verificar no banco que o artigo foi realmente salvo
        console.log('ArticleGenerationScreen: Verifying article in database...');
        
        let verified = false;
        let attempts = 0;
        const maxAttempts = 10; // Reduzido pois o backend já deve ter persistido
        let savedArticle: { id: string; title: string; slug: string; status: string | null } | null = null;

        while (!verified && attempts < maxAttempts && isMountedRef.current) {
          attempts++;
          
          const { data, error: verifyError } = await supabase
            .from('articles')
            .select('id, title, slug, status')
            .eq('id', article.id)
            .single();

          if (data && data.slug) {
            // REGRA: Aceitar tanto 'published' quanto 'draft' como sucesso
            // O importante é que o artigo existe no banco com id e slug
            if (data.status === 'published' || data.status === 'draft') {
              verified = true;
              savedArticle = data;
              console.log('ArticleGenerationScreen: Article verified in database', data);
            }
          } else {
            console.log('ArticleGenerationScreen: Waiting for article persistence...', { 
              attempt: attempts, 
              data,
              error: verifyError 
            });
            await new Promise(resolve => setTimeout(resolve, 400));
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
          console.log('ArticleGenerationScreen: SUCCESS - Article published', savedArticle);
        } else if (article.id && article.slug) {
          // Fallback: O backend disse que salvou, confiar nele
          console.warn('ArticleGenerationScreen: Verification timeout, trusting backend response');
          setProgress(100);
          setCreatedArticle({
            id: article.id,
            title: article.title,
            slug: article.slug,
          });
          setIsComplete(true);
        } else {
          setError(classifyError('Não foi possível confirmar a publicação do artigo. Tente novamente.', true));
        }
      },

      onError: (err) => {
        if (!isMountedRef.current) return;
        console.error('ArticleGenerationScreen: Error', err);
        const hasContent = !!streamingContent || !!lastArticleDataRef.current;
        setError(classifyError(err, hasContent));
      },
    });
  }, [topic, blog.id, streamingContent]);

  // Run generation on mount
  useEffect(() => {
    isMountedRef.current = true;
    runGeneration();

    return () => {
      isMountedRef.current = false;
    };
  }, [runGeneration]);

  // Handle retry - tries to generate again
  const handleRetry = async () => {
    setIsRetrying(true);
    setStreamingContent('');
    setStreamingTitle('');
    lastArticleDataRef.current = null;
    
    await runGeneration();
    setIsRetrying(false);
  };

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

  // Error state with improved UX
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background via-background to-destructive/5">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              {error.type === 'persistence' ? 'Erro ao Salvar' : 
               error.type === 'validation' ? 'Erro na Verificação' : 
               'Erro na Geração'}
            </h2>
            <p className="text-muted-foreground">{error.message}</p>
          </div>

          {/* Show preview if we have content */}
          {error.hasContent && (streamingContent || streamingTitle) && (
            <div className="bg-muted/30 rounded-lg p-4 text-left max-h-40 overflow-y-auto">
              <p className="text-xs text-muted-foreground mb-2">Conteúdo gerado (não perdido):</p>
              <p className="text-sm font-medium text-foreground">{streamingTitle}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                {streamingContent.slice(0, 200)}...
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-center">
            {error.canRetry && (
              <Button 
                onClick={handleRetry} 
                disabled={isRetrying}
                className="gap-2"
              >
                {isRetrying ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Tentando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    {error.hasContent ? 'Tentar Publicar Novamente' : 'Tentar Novamente'}
                  </>
                )}
              </Button>
            )}
            <Button variant="outline" onClick={onCancel} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Gerar do Zero
            </Button>
          </div>
          
          {/* Technical details for debugging */}
          <details className="text-xs text-muted-foreground/70">
            <summary className="cursor-pointer hover:text-muted-foreground">
              Detalhes técnicos
            </summary>
            <p className="mt-2 font-mono text-left bg-muted/20 p-2 rounded">
              Tipo: {error.type}<br/>
              HasContent: {String(error.hasContent)}<br/>
              Msg: {error.message}
            </p>
          </details>
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
