import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

interface ContentImage {
  context: string;
  url: string;
  after_section: number;
}

interface ImagePrompt {
  context: string;
  prompt: string;
  after_section: number;
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

interface ClaimedItem {
  id: string;
  blog_id: string;
  suggested_theme: string;
  keywords: string[] | null;
  generation_source: string | null;
  funnel_stage: string | null;
  chunk_content: string | null;
  persona_id: string | null;
  article_goal: string | null;
  funnel_mode: string | null;
}

interface BlogData {
  id: string;
  user_id: string;
  name: string;
  slug: string;
}

// Calculate internal image count based on word count (automatic standard)
function calculateInternalImageCount(wordCount: number): number {
  if (wordCount <= 1000) return 1;      // Short article: 1 cover + 1 internal
  if (wordCount <= 1500) return 2;      // Medium article: 1 cover + 2 internal
  return 3;                              // Long article: 1 cover + 3 internal
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ========== LOGS: INICIO DA EXECUÇÃO ==========
  const startTime = Date.now();
  const executionId = crypto.randomUUID().slice(0, 8);
  console.log(`[${executionId}][START] Process-queue execution at ${new Date().toISOString()}`);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const processedIds: string[] = [];
  const failedIds: string[] = [];
  const skippedIds: string[] = [];
  let stuckCleaned = 0;

  try {
    // ========== CHECK FOR SPECIFIC ITEM_ID (Execute Now) ==========
    const url = new URL(req.url);
    const specificItemId = url.searchParams.get('item_id');
    
    // Parse request body for item_id as well (for invoke calls)
    let bodyItemId: string | null = null;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        bodyItemId = body?.item_id || null;
      } catch {
        // No body or invalid JSON - that's OK
      }
    }
    
    const itemIdToProcess = specificItemId || bodyItemId;

    // If processing a specific item, skip CRON auth and process directly
    if (itemIdToProcess) {
      console.log(`[${executionId}][SINGLE] Processing specific item: ${itemIdToProcess}`);
      
      // Claim this specific item atomically
      const { data: item, error: claimError } = await supabase
        .from('article_queue')
        .update({ 
          status: 'generating', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', itemIdToProcess)
        .eq('status', 'pending')
        .select(`
          id,
          blog_id,
          suggested_theme,
          keywords,
          generation_source,
          funnel_stage,
          chunk_content,
          persona_id,
          article_goal,
          funnel_mode
        `)
        .single();
      
      if (claimError || !item) {
        console.log(`[${executionId}][SINGLE] Item not found or not pending: ${itemIdToProcess}`);
        return new Response(
          JSON.stringify({ error: 'Item não encontrado ou já em processamento' }), 
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Get blog data
      const { data: blogData } = await supabase
        .from('blogs')
        .select('id, user_id, name, slug')
        .eq('id', item.blog_id)
        .single();
        
      if (!blogData) {
        await supabase
          .from('article_queue')
          .update({ status: 'failed', error_message: 'Blog não encontrado' })
          .eq('id', itemIdToProcess);
        return new Response(
          JSON.stringify({ error: 'Blog não encontrado' }), 
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get automation settings
      const { data: automation } = await supabase
        .from('blog_automation')
        .select('*, mode, content_type')
        .eq('blog_id', item.blog_id)
        .single();

      const automationMode = automation?.mode || 'auto';

      // For "Execute now", we never skip even if mode is manual
      // Determine article status based on mode
      let articleStatus: string;
      if (automationMode === 'suggest') {
        articleStatus = 'draft';
        console.log(`[${executionId}][SINGLE] Mode=suggest: Article will be saved as draft`);
      } else {
        articleStatus = 'published';
        console.log(`[${executionId}][SINGLE] Mode=auto: Article will be published`);
      }

      // Process this single item (simplified - uses same generation flow)
      // The rest of the processing will be handled by the same logic below
      // For now, return success to indicate processing started
      // The actual processing will continue in the batch loop below with this item
      
      // Actually process the item inline
      const typedClaimedItems = [item as ClaimedItem];
      const blogsMap = new Map([[blogData.id, blogData as BlogData]]);
      
      // Continue with normal processing for this single item
      // (The code below will handle it)
    } else {
      // ========== NORMAL CRON MODE: AUTHENTICATE ==========
      const cronSecret = req.headers.get('x-cron-secret');
      const expectedSecret = Deno.env.get('CRON_SECRET');
      
      if (!cronSecret || !expectedSecret || cronSecret !== expectedSecret) {
        console.log('[AUTH] Unauthorized request - invalid or missing X-CRON-SECRET');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========== CLEANUP: ITENS TRAVADOS > 30 MINUTOS ==========
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: stuckItems, error: stuckError } = await supabase
      .from('article_queue')
      .update({
        status: 'failed',
        error_message: 'Timeout: geração excedeu 30 minutos',
        updated_at: new Date().toISOString()
      })
      .eq('status', 'generating')
      .lt('updated_at', thirtyMinutesAgo)
      .select('id');

    if (stuckError) {
      console.log(`[${executionId}][CLEANUP] Error cleaning stuck items:`, stuckError.message);
    } else if (stuckItems?.length) {
      stuckCleaned = stuckItems.length;
      console.log(`[${executionId}][CLEANUP] Marked ${stuckItems.length} stuck items as failed: ${stuckItems.map(i => i.id).join(', ')}`);
    }

    // If we already processed a specific item, skip the batch claim
    // ========== CLAIM ATÔMICO VIA RPC (only for batch mode) ==========
    let typedClaimedItems: ClaimedItem[] = [];
    let blogsMap = new Map<string, BlogData>();
    
    if (itemIdToProcess) {
      // For single item mode, fetch the item we already set to 'generating'
      const { data: singleItem } = await supabase
        .from('article_queue')
        .select('*')
        .eq('id', itemIdToProcess)
        .eq('status', 'generating')
        .single();
        
      if (singleItem) {
        typedClaimedItems = [singleItem as ClaimedItem];
        const { data: blogs } = await supabase
          .from('blogs')
          .select('id, user_id, name, slug')
          .eq('id', singleItem.blog_id);
        blogsMap = new Map<string, BlogData>((blogs || []).map(b => [b.id, b]));
        console.log(`[${executionId}][SINGLE] Processing item: ${singleItem.id}`);
      } else {
        return new Response(
          JSON.stringify({ 
            execution_id: executionId,
            success: false,
            message: 'Item already processed or not found'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Normal batch mode
      const { data: claimedItems, error: claimError } = await supabase
        .rpc('claim_queue_items', { p_limit: 5 });

      if (claimError) {
        throw new Error(`Failed to claim items: ${claimError.message}`);
      }

      if (!claimedItems || claimedItems.length === 0) {
        const duration = Date.now() - startTime;
        console.log(`[${executionId}][END] No pending items. Duration: ${duration}ms, Stuck cleaned: ${stuckCleaned}`);
        return new Response(
          JSON.stringify({ 
            execution_id: executionId,
            processed: 0, 
            failed: 0,
            skipped: 0,
            stuck_cleaned: stuckCleaned,
            duration_ms: duration,
            message: 'No pending items' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      typedClaimedItems = claimedItems as ClaimedItem[];
      console.log(`[${executionId}][CLAIMED] ${typedClaimedItems.length} items: ${typedClaimedItems.map(i => i.id).join(', ')}`);

      // ========== BUSCAR DADOS DOS BLOGS ==========
      const blogIds = [...new Set(typedClaimedItems.map(i => i.blog_id))];
      const { data: blogs } = await supabase
        .from('blogs')
        .select('id, user_id, name, slug')
        .in('id', blogIds);

      blogsMap = new Map<string, BlogData>((blogs || []).map(b => [b.id, b]));
    }

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const item of typedClaimedItems) {
      const blogData = blogsMap.get(item.blog_id);
      
      if (!blogData) {
        console.log(`[${executionId}] Blog not found for item ${item.id}, skipping`);
        failedIds.push(item.id);
        failed++;
        continue;
      }

      try {
        console.log(`[${executionId}] Processing queue item: ${item.id} - ${item.suggested_theme}`);

        // Get automation settings for this blog (incluindo mode e content_type)
        const { data: automation } = await supabase
          .from('blog_automation')
          .select('*, mode, content_type')
          .eq('blog_id', item.blog_id)
          .single();

        // ========== LÓGICA DE MODO (ETAPA 3 - SOBERANO) ==========
        const automationMode = automation?.mode || 'auto';

        // Se modo = 'manual', NÃO gerar - marcar como skipped
        if (automationMode === 'manual') {
          console.log(`[${executionId}] Blog ${item.blog_id} is in MANUAL mode, skipping item ${item.id}`);
          await supabase
            .from('article_queue')
            .update({
              status: 'skipped',
              error_message: 'Automação em modo manual',
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id);
          skippedIds.push(item.id);
          skipped++;
          continue; // Pular para próximo item
        }

        // Determinar status baseado no mode (não mais auto_publish)
        let articleStatus: string;
        let notificationType: string;
        let notificationTitle: string;
        let notificationMessage: string;

        switch (automationMode) {
          case 'suggest':
            // Modo sugestão: salva como rascunho
            articleStatus = 'draft';
            notificationType = 'article_pending_review';
            notificationTitle = '📝 Artigo pronto para revisão!';
            console.log(`[${executionId}] Mode=suggest: Article will be saved as draft`);
            break;
          
          case 'auto':
          default:
            // Modo automático: publica diretamente
            articleStatus = 'published';
            notificationType = 'article_published';
            notificationTitle = '🚀 Artigo publicado!';
            console.log(`[${executionId}] Mode=auto: Article will be published automatically`);
            break;
        }

        // ========== FETCH EDITORIAL TEMPLATE AND BUSINESS PROFILE ==========
        let editorialTemplate: EditorialTemplate | null = null;

        // First try to get the default editorial template
        const { data: template } = await supabase
          .from('editorial_templates')
          .select('*')
          .eq('blog_id', item.blog_id)
          .eq('is_default', true)
          .single();

        if (template) {
          editorialTemplate = template as EditorialTemplate;
          console.log(`[${executionId}] Using editorial template: ${template.name}`);
        }

        // Fetch business profile for fallback/merge
        const { data: businessProfile } = await supabase
          .from('business_profile')
          .select('company_name, niche, tone_of_voice')
          .eq('blog_id', item.blog_id)
          .single();

        // Merge template with business profile data
        if (editorialTemplate) {
          editorialTemplate = {
            ...editorialTemplate,
            company_name: editorialTemplate.company_name || businessProfile?.company_name,
            target_niche: editorialTemplate.target_niche || businessProfile?.niche,
            tone_rules: editorialTemplate.tone_rules || businessProfile?.tone_of_voice
          };
        } else if (businessProfile) {
          // Create minimal template from business profile
          editorialTemplate = {
            company_name: businessProfile.company_name,
            target_niche: businessProfile.niche,
            tone_rules: businessProfile.tone_of_voice
          };
          console.log(`[${executionId}] Using business profile as template fallback: ${businessProfile.company_name}`);
        }

        // ========== PREPARE THEME WITH CHUNK CONTENT IF AVAILABLE ==========
        let generationTheme = item.suggested_theme;
        
        // If this is a PDF chunk, use the chunk content for richer context
        if (item.generation_source === 'pdf' && item.chunk_content) {
          const MAX_CHUNK_LENGTH = 20000; // Limit chunk content to prevent token overflow
          const chunkText = item.chunk_content.length > MAX_CHUNK_LENGTH
            ? item.chunk_content.substring(0, MAX_CHUNK_LENGTH) + '\n\n[...conteúdo truncado...]'
            : item.chunk_content;
          
          generationTheme = `Baseado na seguinte seção do documento "${item.suggested_theme}":\n\n${chunkText}`;
          console.log(`[${executionId}] Using PDF chunk content for generation (${item.chunk_content.length} chars)`);
        }

        // ========== ENGINE V1: Delegate to create-generation-job ==========
        console.log(`[${executionId}] Delegating to Engine v1 via create-generation-job`);
        
        const jobResponse = await fetch(`${supabaseUrl}/functions/v1/create-generation-job`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            keyword: generationTheme,
            blog_id: item.blog_id,
            city: '',
            niche: editorialTemplate?.target_niche || 'default',
            country: 'BR',
            language: 'pt-BR',
            job_type: 'article',
            intent: item.funnel_stage === 'bottom' ? 'transactional' : 'informational',
            target_words: 2500,
            image_count: 4,
          }),
        });

        const jobData = await jobResponse.json();

        if (!jobResponse.ok) {
          const errorCode = jobData.error || 'JOB_CREATION_FAILED';
          console.error(`[${executionId}] Engine v1 job creation error: ${errorCode}`);
          throw new Error(`${errorCode}`);
        }

        console.log(`[${executionId}] Engine v1 job created: ${jobData.job_id}`);
        
        // Engine v1 runs asynchronously — article will be created by orchestrator
        // Engine v1 runs asynchronously — article will be created by orchestrator
        // Mark queue item as processing with job reference
        await supabase
          .from('article_queue')
          .update({
            status: 'generating',
            error_message: `Engine v1 job: ${jobData.job_id}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', item.id);

        console.log(`[${executionId}] Successfully delegated: ${item.id} -> Job: ${jobData.job_id}`);
        processedIds.push(item.id);
        processed++;

      } catch (itemError: unknown) {
        console.error(`[${executionId}] Failed to process item ${item.id}:`, itemError);
        const errorMessage = itemError instanceof Error ? itemError.message : 'Unknown error';
        
        // Create failure notification
        if (blogData?.user_id) {
          await supabase
            .from('automation_notifications')
            .insert({
              user_id: blogData.user_id,
              blog_id: item.blog_id,
              notification_type: 'automation_failed',
              title: 'Falha na automação',
              message: `Erro ao gerar "${item.suggested_theme}". Será reprocessado automaticamente.`
            });
        }
        
        // Update queue item with error
        await supabase
          .from('article_queue')
          .update({
            status: 'failed',
            error_message: errorMessage
          })
          .eq('id', item.id);

        failedIds.push(item.id);
        failed++;
      }
    }

    // ========== LOGS FINAIS ESTRUTURADOS ==========
    const duration = Date.now() - startTime;
    console.log(`[${executionId}][END] Summary:
  - Duration: ${duration}ms
  - Processed: ${processed} [${processedIds.join(', ')}]
  - Skipped (manual mode): ${skipped} [${skippedIds.join(', ')}]
  - Failed: ${failed} [${failedIds.join(', ')}]
  - Stuck cleaned: ${stuckCleaned}`);

    return new Response(
      JSON.stringify({
        execution_id: executionId,
        processed,
        failed,
        skipped,
        processed_ids: processedIds,
        failed_ids: failedIds,
        skipped_ids: skippedIds,
        stuck_cleaned: stuckCleaned,
        duration_ms: duration,
        message: `Processed ${processed} articles, ${skipped} skipped (manual mode), ${failed} failed`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    console.error(`[${executionId}][ERROR] Error in process-queue:`, error);
    const message = error instanceof Error ? error.message : 'Failed to process queue';
    return new Response(
      JSON.stringify({ 
        execution_id: executionId,
        error: message,
        duration_ms: duration,
        stuck_cleaned: stuckCleaned
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
