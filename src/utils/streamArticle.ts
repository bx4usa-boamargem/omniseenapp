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

export type GenerationStage = 'analyzing' | 'structuring' | 'generating' | 'finalizing' | null;

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

    // Stage 2: Structuring
    onStage?.('structuring');
    onProgress?.(15);

    // Get current user for cost tracking
    const { data: { user } } = await supabase.auth.getUser();

    // Use structured endpoint via supabase.functions.invoke (sends user JWT automatically)
    console.log("[streamArticle] Calling generate-article-structured via invoke...", { theme, blogId });
    
    const { data, error: invokeError } = await supabase.functions.invoke('generate-article-structured', {
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
        user_id: user?.id, // ✅ CRITICAL: Pass user_id for cost logging
        funnel_mode: funnelMode || 'middle',
        article_goal: articleGoal || null,
        editorial_model: editorialModel || 'traditional',
        generation_mode: resolvedGenerationMode, // NUNCA undefined - fast ou deep
        auto_publish: options.autoPublish !== false // Default true
      },
    });

    // Stage 3: Generating (response received, processing)
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
      
      // Update progress during generation (30% to 90%)
      const generationProgress = 30 + ((i / totalWords) * 60);
      onProgress?.(Math.round(generationProgress));
      
      // Small delay for streaming effect
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    // Stage 4: Finalizing
    onStage?.('finalizing');
    onProgress?.(95);
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    onProgress?.(100);
    onStage?.(null);
    onDone(article);
  } catch (error) {
    console.error('Article generation error:', error);
    onStage?.(null);
    onError(error instanceof Error ? error.message : 'Erro de conexão');
  }
}
