import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OutlineRequest {
  opportunityId: string;
  blogId: string;
}

interface OutlineH2 {
  title: string;
  h3: string[];
}

interface OutlineResult {
  h1: string;
  h2: OutlineH2[];
  cta: string;
}

// Hard-fail validation for outline structure
function validateOutlineOutput(data: unknown): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Response is not an object' };
  }
  
  const obj = data as Record<string, unknown>;
  
  if (!obj.outline || typeof obj.outline !== 'object') {
    return { valid: false, error: 'Missing or invalid outline field' };
  }
  
  const outline = obj.outline as Record<string, unknown>;
  
  if (!outline.h1 || typeof outline.h1 !== 'string') {
    return { valid: false, error: 'Missing or invalid h1 field' };
  }
  
  if (!Array.isArray(outline.h2)) {
    return { valid: false, error: 'h2 must be an array' };
  }
  
  for (let i = 0; i < outline.h2.length; i++) {
    const section = outline.h2[i] as Record<string, unknown>;
    if (!section.title || typeof section.title !== 'string') {
      return { valid: false, error: `h2[${i}] missing title` };
    }
    if (!Array.isArray(section.h3)) {
      return { valid: false, error: `h2[${i}] missing h3 array` };
    }
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
    let requestData: OutlineRequest;
    try {
      requestData = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'INVALID_REQUEST', message: 'Request body must be valid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { opportunityId, blogId } = requestData;

    if (!opportunityId || !blogId) {
      return new Response(
        JSON.stringify({ error: 'MISSING_FIELDS', message: 'opportunityId and blogId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[OUTLINE] Building outline for opportunity ${opportunityId}, blog ${blogId}`);

    // Fetch opportunity data
    const { data: opportunity, error: oppError } = await supabase
      .from('omnicore_opportunities')
      .select('*')
      .eq('id', opportunityId)
      .single();

    if (oppError || !opportunity) {
      return new Response(
        JSON.stringify({ error: 'OPPORTUNITY_NOT_FOUND', message: `Opportunity ${opportunityId} not found` }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch business profile for context
    const { data: profile } = await supabase
      .from('business_profile')
      .select('*')
      .eq('blog_id', blogId)
      .maybeSingle();

    const niche = profile?.niche || opportunity.title.split(' ')[0] || 'business';
    const territory = opportunity.territory || profile?.city || 'local area';
    const companyName = profile?.company_name || '';

    // Build system prompt for Gemini (Architect role)
    const systemPrompt = `You are OmniCore Architect.
Reference date: January 2026.
Create article outlines for local-authority content.

RULES:
- Generate H1, H2s (4-6 sections), each with 2-3 H3 subsections
- The outline must support 1,200-3,000 word articles
- Include a clear CTA at the end
- Focus on the territory: ${territory}
- Niche: ${niche}
${companyName ? `- Company: ${companyName}` : ''}

Return ONLY a valid JSON object in this exact format:
{
  "outline": {
    "h1": "Main title with territory and year (2026)",
    "h2": [
      {
        "title": "Section title",
        "h3": ["Subsection 1", "Subsection 2", "Subsection 3"]
      }
    ],
    "cta": "Call to action message with territory reference"
  }
}`;

    const userPrompt = `Create an outline for this article:

Title: ${opportunity.title}
Primary Keyword: ${opportunity.primary_kw || opportunity.title}
Secondary Keywords: ${(opportunity.secondary_kw || []).join(', ') || 'N/A'}
Intent: ${opportunity.intent || 'informational'}
Territory: ${territory}
Angle: ${opportunity.angle || 'local-authority'}

Generate the outline JSON.`;

    console.log(`[OUTLINE] Calling AI Gateway with Gemini...`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      console.error('[OUTLINE] AI Gateway error:', status, errorText);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'RATE_LIMIT', message: 'Rate limit exceeded. Try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (status === 402) {
        return new Response(
          JSON.stringify({ error: 'PAYMENT_REQUIRED', message: 'Insufficient credits.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error(`AI Gateway error: ${status}`);
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'EMPTY_RESPONSE', message: 'AI returned empty response' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate JSON output (HARD-FAIL)
    let parsedResponse: { outline: OutlineResult };
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      parsedResponse = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('[OUTLINE] Failed to parse AI response:', content);
      return new Response(
        JSON.stringify({ error: 'INVALID_JSON', message: 'AI returned invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate outline structure (HARD-FAIL)
    const validation = validateOutlineOutput(parsedResponse);
    if (!validation.valid) {
      console.error('[OUTLINE] Validation failed:', validation.error);
      return new Response(
        JSON.stringify({ error: 'INVALID_OUTPUT', message: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save to omnicore_outlines
    const { data: savedOutline, error: saveError } = await supabase
      .from('omnicore_outlines')
      .insert({
        omnicore_opportunity_id: opportunityId,
        outline: parsedResponse.outline,
      })
      .select('id')
      .single();

    if (saveError) {
      console.error('[OUTLINE] Failed to save outline:', saveError);
      throw new Error(`Failed to save outline: ${saveError.message}`);
    }

    // Update opportunity status
    await supabase
      .from('omnicore_opportunities')
      .update({ status: 'outlined' })
      .eq('id', opportunityId);

    console.log(`[OUTLINE] ✅ Outline saved: ${savedOutline.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        outline_id: savedOutline.id,
        outline: parsedResponse.outline,
        architect_model: 'google/gemini-2.5-flash',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[OUTLINE] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'INTERNAL_ERROR', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
