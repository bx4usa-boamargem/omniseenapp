import { supabase } from '@/integrations/supabase/client';

export interface ImagePrompt {
  context: 'problem' | 'solution' | 'result' | 'section_1' | 'section_2' | 'section_3' | 'section_4';
  prompt: string;
  after_section: number;
  section_title?: string;
  visual_concept?: string;
}

export interface ArticleData {
  id?: string; // ID do artigo salvo no banco
  title: string;
  slug?: string; // Slug do artigo
  status?: string; // Status do artigo (published, draft, etc.)
  meta_description: string;
  excerpt: string;
  content: string;
  faq: Array<{ question: string; answer: string }>;
  reading_time?: number;
  image_prompts?: ImagePrompt[];
  featured_image_url?: string | null;
  content_images?: Array<{ context: string; url: string; after_section: number }>;
}

interface EditorialTemplate {
  company_name?: string;
  target_niche?: string;
  content_focus?: string;
  mandatory_structure?: Array<{ heading: string; key_message: string }>;
  title_guidelines?: string;
  tone_rules?: string;
  seo_settings?: {
    main_keyword?: string;
    secondary_keywords?: string[];
    search_intent?: string;
  };
  cta_template?: string;
  image_guidelines?: {
    cover?: string;
    internal?: string;
    style?: string;
  };
  category_default?: string;
}

export type GenerationStage = 'analyzing' | 'generating' | 'finalizing' | null;

// Editorial Model Type
export type EditorialModel = 'traditional' | 'strategic' | 'visual_guided';

// Generation Mode Type - fast (400-1000 palavras) ou deep (1500-3000 palavras)
export type GenerationMode = 'fast' | 'deep';

export interface StreamArticleOptions {
  theme: string;
  keywords?: string[];
  tone: 'formal' | 'casual' | 'technical' | 'friendly';
  category?: string;
  blogId?: string;
  imageCount?: number;
  wordCount?: number;
  sectionCount?: number;
  includeFaq?: boolean;
  includeConclusion?: boolean;
  includeVisualBlocks?: boolean;
  optimizeForAI?: boolean;
  source?: 'chat' | 'instagram' | 'youtube' | 'pdf' | 'url' | 'form';
  funnelMode?: 'top' | 'middle' | 'bottom';
  articleGoal?: 'educar' | 'autoridade' | 'apoiar_vendas' | 'converter' | null;
  editorialModel?: EditorialModel;
  generationMode?: GenerationMode; // fast = 400-1000 palavras, deep = 1500-3000 palavras
  autoPublish?: boolean; // Default true - auto-publicar o artigo
  articleId?: string; // V4.7.3: ID do placeholder para fallback
  onDelta: (text: string) => void;
  onDone: (article: ArticleData | null) => void;
  onError: (error: string) => void;
  onStage?: (stage: GenerationStage) => void;
  onProgress?: (percent: number) => void;
}

async function fetchEditorialTemplate(blogId: string): Promise<EditorialTemplate | null> {
  try {
    // First try to get the default editorial template
    const { data: template } = await supabase
      .from('editorial_templates')
      .select('*')
      .eq('blog_id', blogId)
      .eq('is_default', true)
      .single();

    if (template) {
      // Map database fields to EditorialTemplate interface
      return {
        company_name: template.company_name ?? undefined,
        target_niche: template.target_niche ?? undefined,
        content_focus: template.content_focus ?? undefined,
        mandatory_structure: Array.isArray(template.mandatory_structure) 
          ? (template.mandatory_structure as Array<{ heading: string; key_message: string }>)
          : undefined,
        title_guidelines: template.title_guidelines ?? undefined,
        tone_rules: template.tone_rules ?? undefined,
        seo_settings: template.seo_settings as EditorialTemplate['seo_settings'],
        cta_template: template.cta_template ?? undefined,
        image_guidelines: template.image_guidelines as EditorialTemplate['image_guidelines'],
        category_default: template.category_default ?? undefined
      };
    }

    // Fallback to business_profile
    const { data: profile } = await supabase
      .from('business_profile')
      .select('company_name, niche, tone_of_voice')
      .eq('blog_id', blogId)
      .single();

    if (profile) {
      return {
        company_name: profile.company_name,
        target_niche: profile.niche,
        tone_rules: profile.tone_of_voice
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching editorial template:', error);
    return null;
  }
}

export async function streamArticle(options: StreamArticleOptions): Promise<void> {
  const { 
    theme, keywords, tone, category, blogId, imageCount, wordCount,
    sectionCount, includeFaq, includeConclusion, includeVisualBlocks, optimizeForAI,
    source, funnelMode, articleGoal, editorialModel, generationMode,
    onDelta, onDone, onError, onStage, onProgress 
  } = options;

  // Resolver generation_mode: chat/instagram = fast, resto = deep (NUNCA undefined)
  const resolvedGenerationMode: GenerationMode = 
    generationMode || 
    (source === 'chat' || source === 'instagram' ? 'fast' : 'deep');

  try {
    // Stage 1: Analyzing
    console.log('[V4.7.2] stage analyzing');
    onStage?.('analyzing');
    onProgress?.(0);

    // Fetch editorial template if blogId is provided
    let editorialTemplate: EditorialTemplate | null = null;
    if (blogId) {
      editorialTemplate = await fetchEditorialTemplate(blogId);
      if (editorialTemplate) {
        console.log('Using editorial template:', editorialTemplate.company_name || 'unnamed');
      }
    }

    // Get current user for cost tracking
    const { data: { user } } = await supabase.auth.getUser();

    // V4.7.2: Timer de progresso gradual durante espera do invoke (10% → 28%)
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    let currentProgress = 10;
    onProgress?.(10);

    progressTimer = setInterval(() => {
      if (currentProgress < 28) {
        currentProgress += 2;
        onProgress?.(currentProgress);
      }
    }, 2000);

    // Use structured endpoint via supabase.functions.invoke (sends user JWT automatically)
    console.log('[V4.7.2] invoking backend', { theme, blogId });
    
    let data: any;
    let invokeError: any;
    
    try {
      const result = await supabase.functions.invoke('generate-article-structured', {
        body: { 
          theme, 
          keywords, 
          tone, 
          category,
          editorial_template: editorialTemplate,
          image_count: imageCount ?? 3,
          word_count: wordCount,
          section_count: sectionCount,
          include_faq: includeFaq,
          include_conclusion: includeConclusion,
          include_visual_blocks: includeVisualBlocks,
          optimize_for_ai: optimizeForAI,
          source: source || 'form',
          blog_id: blogId,
          user_id: user?.id,
          funnel_mode: funnelMode || 'middle',
          article_goal: articleGoal || null,
          editorial_model: editorialModel || 'traditional',
          generation_mode: resolvedGenerationMode,
          auto_publish: options.autoPublish !== false
        },
      });
      data = result.data;
      invokeError = result.error;
    } finally {
      // V4.7.2: SEMPRE cancelar timer, sucesso ou erro
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
    }

    // V4.7.2: Emitir generating imediatamente após resposta
    console.log('[V4.7.2] stage generating');
    onStage?.('generating');
    onProgress?.(30);

    if (invokeError) {
      console.error("[streamArticle] Edge function error:", invokeError);
      const errorMsg = invokeError.message || '';
      if (errorMsg.includes('429')) {
        onError('Limite de requisições excedido. Aguarde alguns minutos e tente novamente.');
        return;
      }
      if (errorMsg.includes('402')) {
        onError('Créditos insuficientes. Adicione créditos à sua conta.');
        return;
      }
      onError(invokeError.message || 'Erro ao gerar artigo');
      return;
    }

    console.log("[streamArticle] Response received:", { success: data?.success, hasArticle: !!data?.article });
    
    if (!data.success || !data.article) {
      onError(data.message || 'Erro ao processar resposta da IA');
      onDone(null);
      return;
    }

    const article: ArticleData = {
      id: data.article.id, // ID do artigo salvo
      slug: data.article.slug, // Slug do artigo
      title: data.article.title,
      meta_description: data.article.meta_description,
      excerpt: data.article.excerpt,
      content: data.article.content,
      faq: data.article.faq || [],
      reading_time: data.article.reading_time,
      image_prompts: data.article.image_prompts || []
    };

    // Simulate streaming effect for the content with progress updates
    const words = article.content.split(' ');
    let displayed = '';
    const totalWords = words.length;
    
    for (let i = 0; i < totalWords; i++) {
      displayed += (i > 0 ? ' ' : '') + words[i];
      onDelta(words[i] + (i < totalWords - 1 ? ' ' : ''));
      
      // Update progress during generation (30% to 85%)
      const generationProgress = 30 + ((i / totalWords) * 55);
      onProgress?.(Math.round(generationProgress));
      
      // Small delay for streaming effect
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Stage 4: Finalizing
    console.log('[V4.7.2] stage finalizing');
    onStage?.('finalizing');
    onProgress?.(95);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    onProgress?.(100);
    onDone(article);
  } catch (error) {
    console.error('Article generation error:', error);
    const errorMsg = error instanceof Error ? error.message : '';
    const isTimeout =
      errorMsg.includes('Failed to fetch') ||
      errorMsg.includes('FunctionsFetchError') ||
      errorMsg.includes('Failed to send');

    if (isTimeout && blogId) {
      console.log('[V4.7.3] Timeout detectado. Tentando recuperar artigo...');
      onStage?.('finalizing');
      onProgress?.(90);

      await new Promise(resolve => setTimeout(resolve, 5000));

      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: recovered } = await supabase
        .from('articles')
        .select('id, title, slug, status, content, excerpt, meta_description, faq')
        .eq('blog_id', blogId)
        .eq('status', 'published')
        .gte('created_at', fiveMinAgo)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recovered && recovered.content) {
        console.log('[V4.7.3] Artigo recuperado com sucesso:', recovered.id);
        onProgress?.(95);

        const words = recovered.content.split(' ');
        for (let i = 0; i < words.length; i++) {
          onDelta(words[i] + ' ');
          if (i % 30 === 0) await new Promise(r => setTimeout(r, 5));
        }

        onProgress?.(100);
        onDone({
          id: recovered.id,
          slug: recovered.slug,
          title: recovered.title,
          content: recovered.content,
          excerpt: recovered.excerpt || '',
          meta_description: recovered.meta_description || '',
          faq: Array.isArray(recovered.faq) ? (recovered.faq as Array<{ question: string; answer: string }>) : [],
        });
        return;
      }

      console.log('[V4.7.3] Artigo NAO encontrado apos timeout.');
    }

    onError(error instanceof Error ? error.message : 'Erro de conexão');
  }
}
