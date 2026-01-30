/**
 * SEO Enhancer Job - Background Enhancement for Articles
 * 
 * V4.0: Runs AFTER article generation to add deep SERP analysis without blocking UI.
 * 
 * This job:
 * 1. Receives article_id after initial save
 * 2. Runs analyze-serp WITH Firecrawl (deep scraping)
 * 3. Updates article with SEO enhancements (FAQs, content gaps, etc.)
 * 4. Does NOT block the user - runs entirely in background
 * 
 * Trigger: Dispatched by generate-article-structured AFTER persistArticleToDb
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface SEOJobRequest {
  article_id: string;
  blog_id: string;
  request_id: string;
  keyword: string;
  territory?: string;
}

interface SerpMatrix {
  commonTerms?: string[];
  topTitles?: string[];
  contentGaps?: string[];
  averages?: { avgWords?: number; avgH2?: number; avgImages?: number };
  competitors?: Array<{ url: string; title: string }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body: SEOJobRequest = await req.json();
    const { article_id, blog_id, request_id, keyword, territory } = body;
    
    if (!article_id || !blog_id) {
      return new Response(
        JSON.stringify({ error: 'article_id and blog_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const jobId = request_id || crypto.randomUUID();
    console.log(`[${jobId}][SEO-Job] 🚀 Starting async enhancement for article ${article_id}`);

    // 1. Fetch current article
    const { data: article, error: fetchError } = await supabase
      .from('articles')
      .select('content, title, faq, keywords, serp_enhanced')
      .eq('id', article_id)
      .single();

    if (fetchError || !article) {
      console.error(`[${jobId}][SEO-Job] ❌ Article not found: ${article_id}`);
      return new Response(
        JSON.stringify({ error: 'Article not found', article_id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip if already enhanced
    if (article.serp_enhanced) {
      console.log(`[${jobId}][SEO-Job] ⏭️ Article already enhanced, skipping`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: 'already_enhanced' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Run analyze-serp WITH Firecrawl (now in background - no rush)
    console.log(`[${jobId}][SEO-Job] Running deep SERP analysis with Firecrawl...`);
    const serpStart = Date.now();
    
    let serpMatrix: SerpMatrix = {};
    let serpSuccess = false;
    
    try {
      const serpResponse = await fetch(`${SUPABASE_URL}/functions/v1/analyze-serp`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          keyword: keyword || article.title,
          territory: territory || null,
          blogId: blog_id,
          forceRefresh: true,
          useFirecrawl: true, // Deep scraping enabled
        }),
      });

      if (serpResponse.ok) {
        const serpData = await serpResponse.json();
        serpMatrix = serpData?.matrix || {};
        serpSuccess = true;
        console.log(`[${jobId}][SEO-Job] ✅ SERP analysis complete in ${Date.now() - serpStart}ms`);
        console.log(`[${jobId}][SEO-Job] Competitors: ${serpMatrix.competitors?.length || 0}, Gaps: ${serpMatrix.contentGaps?.length || 0}`);
      } else {
        const errText = await serpResponse.text().catch(() => 'unknown');
        console.warn(`[${jobId}][SEO-Job] ⚠️ SERP analysis returned ${serpResponse.status}: ${errText.substring(0, 200)}`);
      }
    } catch (serpError) {
      console.error(`[${jobId}][SEO-Job] ⚠️ SERP analysis error:`, serpError);
      // Continue - we can still mark as processed
    }

    // 3. Generate additional FAQs based on content gaps
    const contentGaps = serpMatrix.contentGaps || [];
    const existingFaq: Array<{ question: string; answer: string }> = article.faq || [];
    const existingQuestions = new Set(existingFaq.map(f => f.question.toLowerCase()));
    
    // Filter gaps that aren't already covered by existing FAQs
    const newQuestions = contentGaps
      .filter(gap => !existingQuestions.has(gap.toLowerCase()))
      .slice(0, 3);
    
    const additionalFaqs = newQuestions.map(gap => ({
      question: gap.endsWith('?') ? gap : `${gap}?`,
      answer: `Esta é uma dúvida comum sobre \"${keyword || article.title}\". Baseado na análise de mercado, recomendamos consultar um especialista local para orientação personalizada.`
    }));

    console.log(`[${jobId}][SEO-Job] Generated ${additionalFaqs.length} additional FAQs from content gaps`);

    // 4. Merge FAQs (keep existing + add new, max 8)
    const mergedFaq = [...existingFaq, ...additionalFaqs].slice(0, 8);

    // 5. Update article with enhancements
    const updateData: Record<string, unknown> = {
      serp_enhanced: true,
      serp_enhanced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Only update FAQ if we added new ones
    if (additionalFaqs.length > 0) {
      updateData.faq = mergedFaq;
    }

    // Store SERP matrix in source_payload for future reference
    if (serpSuccess && Object.keys(serpMatrix).length > 0) {
      // Fetch current source_payload and merge
      const { data: currentArticle } = await supabase
        .from('articles')
        .select('source_payload')
        .eq('id', article_id)
        .single();
      
      const existingPayload = (currentArticle?.source_payload as Record<string, unknown>) || {};
      updateData.source_payload = {
        ...existingPayload,
        serpEnhancement: {
          enhanced_at: new Date().toISOString(),
          job_id: jobId,
          competitors_found: serpMatrix.competitors?.length || 0,
          content_gaps_found: contentGaps.length,
          faqs_added: additionalFaqs.length,
          avg_competitor_words: serpMatrix.averages?.avgWords || null,
        }
      };
    }

    const { error: updateError } = await supabase
      .from('articles')
      .update(updateData)
      .eq('id', article_id);

    if (updateError) {
      console.error(`[${jobId}][SEO-Job] ❌ Update failed:`, updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update article', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${jobId}][SEO-Job] ✅ Article ${article_id} enhanced successfully`);

    // 6. Log consumption for billing/analytics
    try {
      await supabase.from('consumption_logs').insert({
        user_id: null, // Background job - no user context
        blog_id,
        action_type: 'seo_enhancement',
        action_description: `SEO async enhancement for article ${article_id}`,
        metadata: {
          request_id: jobId,
          keyword,
          territory,
          serp_success: serpSuccess,
          competitors_analyzed: serpMatrix.competitors?.length || 0,
          content_gaps_found: contentGaps.length,
          faqs_added: additionalFaqs.length,
          duration_ms: Date.now() - serpStart,
        },
      });
    } catch (logError) {
      console.warn(`[${jobId}][SEO-Job] Failed to log consumption:`, logError);
      // Non-blocking - continue
    }

    // 7. Return success
    const totalDuration = Date.now() - serpStart;
    console.log(`[${jobId}][SEO-Job] 🏁 Job completed in ${totalDuration}ms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        article_id,
        job_id: jobId,
        enhancements: {
          serp_analyzed: serpSuccess,
          faqs_added: additionalFaqs.length,
          competitors_found: serpMatrix.competitors?.length || 0,
          content_gaps_identified: contentGaps.length,
        },
        duration_ms: totalDuration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[SEO-Job] ❌ Unhandled error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
