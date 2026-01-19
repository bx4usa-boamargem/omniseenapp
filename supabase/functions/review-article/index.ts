import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReviewRequest {
  articleId: string;
  blogId: string;
  omnicoreArticleId: string;
}

interface ReviewIssue {
  type: 'critical' | 'warning' | 'info';
  code: string;
  message: string;
}

interface ReviewResult {
  approved: boolean;
  score: number;
  word_count: number;
  issues: ReviewIssue[];
  suggestions: string[];
  qa_model: string;
}

// Minimum word count for OmniCore articles (HARD RULE)
const MIN_WORD_COUNT = 1200;
const QA_MODEL = 'google/gemini-2.5-flash';

// Count words in content
function countWords(content: string): number {
  if (!content) return 0;
  // Remove HTML tags for accurate count
  const textOnly = content.replace(/<[^>]*>/g, ' ');
  return textOnly.split(/\s+/).filter(word => word.length > 0).length;
}

// Validate review output from AI
function validateReviewOutput(data: unknown): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Response is not an object' };
  }
  
  const obj = data as Record<string, unknown>;
  
  if (typeof obj.seo_score !== 'number') {
    return { valid: false, error: 'Missing seo_score' };
  }
  
  if (!Array.isArray(obj.issues)) {
    return { valid: false, error: 'Missing issues array' };
  }
  
  if (!Array.isArray(obj.suggestions)) {
    return { valid: false, error: 'Missing suggestions array' };
  }
  
  return { valid: true };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Parse and validate request
    let requestData: ReviewRequest;
    try {
      requestData = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'INVALID_REQUEST', message: 'Request body must be valid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { articleId, blogId, omnicoreArticleId } = requestData;

    if (!articleId || !blogId || !omnicoreArticleId) {
      return new Response(
        JSON.stringify({ error: 'MISSING_FIELDS', message: 'articleId, blogId, and omnicoreArticleId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[REVIEW] Reviewing article ${articleId} for blog ${blogId}`);

    // Fetch article data
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (articleError || !article) {
      return new Response(
        JSON.stringify({ error: 'ARTICLE_NOT_FOUND', message: `Article ${articleId} not found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch business profile for territory context
    const { data: profile } = await supabase
      .from('business_profile')
      .select('city, niche, company_name')
      .eq('blog_id', blogId)
      .maybeSingle();

    const territory = profile?.city || 'local area';
    const niche = profile?.niche || 'business';

    // Calculate word count (HARD RULE CHECK)
    const wordCount = countWords(article.content || '');
    console.log(`[REVIEW] Word count: ${wordCount} (min: ${MIN_WORD_COUNT})`);

    const issues: ReviewIssue[] = [];
    const suggestions: string[] = [];

    // HARD RULE: Word count >= 1200
    if (wordCount < MIN_WORD_COUNT) {
      issues.push({
        type: 'critical',
        code: 'WORD_COUNT_LOW',
        message: `Word count ${wordCount} is below minimum ${MIN_WORD_COUNT}`,
      });
    }

    // Check for unique H1
    const h1Matches = (article.content || '').match(/<h1[^>]*>.*?<\/h1>/gi) || [];
    if (h1Matches.length === 0) {
      issues.push({
        type: 'critical',
        code: 'MISSING_H1',
        message: 'Article is missing H1 heading',
      });
    } else if (h1Matches.length > 1) {
      issues.push({
        type: 'warning',
        code: 'MULTIPLE_H1',
        message: `Found ${h1Matches.length} H1 headings, should have only 1`,
      });
    }

    // Check for territory mention
    const contentLower = (article.content || '').toLowerCase();
    const titleLower = (article.title || '').toLowerCase();
    const territoryLower = territory.toLowerCase();
    const territoryMentioned = contentLower.includes(territoryLower) || titleLower.includes(territoryLower);
    
    if (!territoryMentioned) {
      issues.push({
        type: 'warning',
        code: 'TERRITORY_MISSING',
        message: `Territory "${territory}" not mentioned in content or title`,
      });
    }

    // Check for "Próximo passo" / "Next step" section
    const hasNextStep = contentLower.includes('próximo passo') || 
                        contentLower.includes('next step') ||
                        contentLower.includes('entre em contato') ||
                        contentLower.includes('contact us') ||
                        contentLower.includes('fale conosco');
    
    if (!hasNextStep) {
      issues.push({
        type: 'warning',
        code: 'MISSING_CTA_SECTION',
        message: 'Missing "Próximo passo" / CTA section at the end',
      });
    }

    // Check meta description
    if (!article.meta_description || article.meta_description.length < 50) {
      issues.push({
        type: 'warning',
        code: 'META_DESCRIPTION_SHORT',
        message: 'Meta description is missing or too short (min 50 chars)',
      });
    } else if (article.meta_description.length > 160) {
      issues.push({
        type: 'info',
        code: 'META_DESCRIPTION_LONG',
        message: 'Meta description is too long (max 160 chars)',
      });
    }

    // Use Gemini for semantic SEO analysis
    const systemPrompt = `You are OmniCore Auditor (QA).
Reference date: January 2026.
Analyze the article for SEO quality, clarity, and local authority.

Territory: ${territory}
Niche: ${niche}
Word Count: ${wordCount}

Return ONLY a valid JSON object:
{
  "seo_score": <number 0-100>,
  "issues": [{"type": "warning", "code": "CODE", "message": "description"}],
  "suggestions": ["suggestion 1", "suggestion 2"]
}`;

    const userPrompt = `Analyze this article:

Title: ${article.title}
Meta Description: ${article.meta_description || 'N/A'}
Keywords: ${(article.keywords || []).join(', ') || 'N/A'}

Content (first 3000 chars):
${(article.content || '').substring(0, 3000)}

Check for:
1. Semantic SEO quality
2. Content clarity and readability
3. Local authority signals
4. Structural consistency (H2/H3 hierarchy)
5. Actionable value for the reader`;

    console.log(`[REVIEW] Calling AI Gateway for semantic analysis...`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: QA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    let aiScore = 70; // Default score if AI fails
    
    if (response.ok) {
      const aiData = await response.json();
      const content = aiData.choices?.[0]?.message?.content;

      if (content) {
        try {
          const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
          const aiResult = JSON.parse(cleanContent);
          
          const validation = validateReviewOutput(aiResult);
          if (validation.valid) {
            aiScore = aiResult.seo_score || 70;
            
            // Add AI-detected issues
            for (const issue of aiResult.issues || []) {
              if (issue.type && issue.code && issue.message) {
                issues.push(issue);
              }
            }
            
            // Add AI suggestions
            for (const suggestion of aiResult.suggestions || []) {
              if (typeof suggestion === 'string') {
                suggestions.push(suggestion);
              }
            }
          }
        } catch (parseError) {
          console.error('[REVIEW] Failed to parse AI response:', parseError);
        }
      }
    } else {
      console.error('[REVIEW] AI Gateway error:', response.status);
    }

    // Calculate final score
    const criticalIssues = issues.filter(i => i.type === 'critical').length;
    const warningIssues = issues.filter(i => i.type === 'warning').length;
    
    let finalScore = aiScore;
    finalScore -= criticalIssues * 20; // -20 per critical
    finalScore -= warningIssues * 5;   // -5 per warning
    finalScore = Math.max(0, Math.min(100, finalScore));

    // Determine approval (HARD RULES)
    const approved = wordCount >= MIN_WORD_COUNT && 
                     criticalIssues === 0 && 
                     finalScore >= 80;

    console.log(`[REVIEW] Score: ${finalScore}, Approved: ${approved}, Critical: ${criticalIssues}`);

    // Save review to omnicore_reviews
    const { data: savedReview, error: saveError } = await supabase
      .from('omnicore_reviews')
      .insert({
        omnicore_article_id: omnicoreArticleId,
        approved,
        score: finalScore,
        issues,
        suggestions,
        qa_model: QA_MODEL,
        word_count_validated: wordCount,
      })
      .select('id')
      .single();

    if (saveError) {
      console.error('[REVIEW] Failed to save review:', saveError);
      throw new Error(`Failed to save review: ${saveError.message}`);
    }

    // Update omnicore_articles status
    const newStatus = approved ? 'approved' : 'needs_revision';
    await supabase
      .from('omnicore_articles')
      .update({ status: newStatus })
      .eq('id', omnicoreArticleId);

    // If approved, update article quality_gate_status
    if (approved) {
      await supabase
        .from('articles')
        .update({ quality_gate_status: 'approved' })
        .eq('id', articleId);
    }

    console.log(`[REVIEW] ✅ Review saved: ${savedReview.id}`);

    const result: ReviewResult = {
      approved,
      score: finalScore,
      word_count: wordCount,
      issues,
      suggestions,
      qa_model: QA_MODEL,
    };

    return new Response(
      JSON.stringify({
        success: true,
        review_id: savedReview.id,
        ...result,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[REVIEW] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'INTERNAL_ERROR', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
