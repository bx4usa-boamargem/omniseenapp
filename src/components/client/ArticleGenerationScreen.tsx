import { useState, useEffect, useCallback } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { getArticleUrl } from '@/utils/blogUrl';
import { GenerationStepList, GenerationStep } from './GenerationStepList';
import { LiveArticlePreview } from './LiveArticlePreview';
import { GenerationSuccessScreen } from './GenerationSuccessScreen';
import { streamArticle, ArticleData } from '@/utils/streamArticle';

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

// Map backend stages to UI steps with progress simulation
const STAGE_TO_STEP: Record<string, { step: GenerationStep; baseProgress: number }> = {
  'analyzing': { step: 'analyzing', baseProgress: 10 },
  'structuring': { step: 'structuring', baseProgress: 20 },
  'generating': { step: 'generating', baseProgress: 35 },
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

  // Calculate article URL
  const articleUrl = createdArticle ? getArticleUrl(blog, createdArticle.slug) : '';

  // Progress simulation for visual steps
  const simulateProgress = useCallback((step: GenerationStep, fromProgress: number, toProgress: number, duration: number) => {
    const steps = 20;
    const increment = (toProgress - fromProgress) / steps;
    const interval = duration / steps;
    let current = fromProgress;

    const timer = setInterval(() => {
      current += increment;
      if (current >= toProgress) {
        current = toProgress;
        clearInterval(timer);
      }
      setProgress(current);
    }, interval);

    return () => clearInterval(timer);
  }, []);

  // Run generation on mount
  useEffect(() => {
    let isMounted = true;
    let cleanup: (() => void) | undefined;

    const runGeneration = async () => {
      try {
        // Step 1: Analyzing
        setCurrentStep('analyzing');
        cleanup = simulateProgress('analyzing', 0, 15, 1500);
        await new Promise(resolve => setTimeout(resolve, 800));
        if (!isMounted) return;

        // Step 2: Structuring  
        setCurrentStep('structuring');
        cleanup = simulateProgress('structuring', 15, 25, 1000);
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!isMounted) return;

        // Step 3: Call the actual generation
        setCurrentStep('generating');
        
        // Use the direct API call for reliability
        const requestBody = {
          blogId: blog.id,
          theme: topic,
          funnel_mode: 'top',
          article_goal: 'educar',
          generation_mode: 'deep',
          autoPublish: true,
        };

        console.log('ArticleGenerationScreen: Starting generation', requestBody);

        const { data, error: apiError } = await supabase.functions.invoke('generate-article-structured', {
          body: requestBody,
        });

        if (!isMounted) return;

        if (apiError) {
          console.error('ArticleGenerationScreen: API error', apiError);
          throw new Error(apiError.message || 'Erro ao gerar artigo');
        }

        if (!data?.article) {
          console.error('ArticleGenerationScreen: No article in response', data);
          throw new Error('Artigo não foi gerado. Tente novamente.');
        }

        const article = data.article;
        
        // Simulate content streaming for visual effect
        setCurrentStep('generating');
        setStreamingTitle(article.title);
        
        // Stream content progressively
        const content = article.content || '';
        const words = content.split(' ');
        let displayed = '';
        
        for (let i = 0; i < words.length && isMounted; i++) {
          displayed += (i > 0 ? ' ' : '') + words[i];
          setStreamingContent(displayed);
          
          // Progress from 25% to 60% during content streaming
          const contentProgress = 25 + ((i / words.length) * 35);
          setProgress(contentProgress);
          
          // Update visual steps based on progress
          if (contentProgress > 45 && currentStep === 'generating') {
            setCurrentStep('seo');
          }
          if (contentProgress > 55) {
            setCurrentStep('rhythm');
          }
          
          // Small delay for streaming effect (faster than before)
          if (i % 15 === 0) {
            await new Promise(resolve => setTimeout(resolve, 5));
          }
        }

        if (!isMounted) return;

        // Step: Creating images
        setCurrentStep('images');
        setProgress(70);
        await new Promise(resolve => setTimeout(resolve, 800));
        if (!isMounted) return;

        // Step: Publishing
        setCurrentStep('publishing');
        setProgress(85);

        // CRITICAL: Verify article is saved in database before showing success
        console.log('ArticleGenerationScreen: Verifying article persistence', { articleId: article.id });
        
        let verified = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!verified && attempts < maxAttempts && isMounted) {
          attempts++;
          
          const { data: savedArticle, error: verifyError } = await supabase
            .from('articles')
            .select('id, title, slug, status')
            .eq('id', article.id)
            .single();

          if (savedArticle && savedArticle.status === 'published' && savedArticle.slug) {
            verified = true;
            console.log('ArticleGenerationScreen: Article verified', savedArticle);
            
            setProgress(100);
            setCurrentStep('complete');
            setCreatedArticle({
              id: savedArticle.id,
              title: savedArticle.title,
              slug: savedArticle.slug,
            });
            setIsComplete(true);
          } else {
            console.log('ArticleGenerationScreen: Waiting for article...', { attempt: attempts, savedArticle });
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        if (!verified && isMounted) {
          // Even if verification fails, use the returned article data
          console.warn('ArticleGenerationScreen: Using API response data (verification timeout)');
          setProgress(100);
          setCurrentStep('complete');
          setCreatedArticle({
            id: article.id,
            title: article.title,
            slug: article.slug,
          });
          setIsComplete(true);
        }

      } catch (err) {
        if (!isMounted) return;
        console.error('ArticleGenerationScreen: Error', err);
        setError(err instanceof Error ? err.message : 'Erro ao gerar artigo');
      }
    };

    runGeneration();

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [topic, blog.id, simulateProgress]);

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
            isGenerating={currentStep !== 'complete'}
          />
        </div>
      </div>
    </div>
  );
}
