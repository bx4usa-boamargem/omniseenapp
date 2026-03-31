import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateAutoKeywords } from '../_shared/keywordGenerator.ts';
import { 
  buildSEOEditorSystemPrompt, 
  buildContentExpansionPrompt, 
  buildDensityOptimizationPrompt,
  detectConclusionType,
  type BusinessContext 
} from '../_shared/professionalEditorPrompt.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImproveRequest {
  type: 'title' | 'meta' | 'content' | 'density';
  currentValue: string;
  keywords?: string[]; // Now optional - will be auto-generated if missing
  context?: string; // article content for context
  articleTitle?: string;
  user_id?: string;
  blog_id?: string;
  article_id?: string; // Used to persist auto-generated keywords
  wordCount?: number; // current word count
  targetWordCount?: number; // target word count to reach
}

// Helper: Extract image URLs from HTML/Markdown content
function extractImageUrls(content: string): string[] {
  const patterns = [
    /<img[^>]+src=["']([^"']+)["']/gi,    // HTML img tags
    /!\[[^\]]*\]\(([^)]+)\)/g,             // Markdown images
    /src=["']([^"']+\.(?:jpg|jpeg|png|gif|webp)[^"']*)["']/gi
  ];
  
  const urls = new Set<string>();
  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) urls.add(match[1]);
    }
  }
  return Array.from(urls);
}

// Helper: Extract H2/H3 headings
function extractHeadings(content: string): string[] {
  const patterns = [
    /<h[23][^>]*>([^<]+)<\/h[23]>/gi,      // HTML headings
    /^#{2,3}\s+(.+)$/gm                     // Markdown headings
  ];
  
  const headings: string[] = [];
  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) headings.push(match[1].trim());
    }
  }
  return headings;
}

// Helper: Escape regex special characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { type, currentValue, keywords, context, articleTitle, user_id, blog_id, article_id, wordCount, targetWordCount }: ImproveRequest = await req.json();

    // Only validate type - keywords will be auto-generated if missing
    if (!type) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch AI model preference from content_preferences
    let textModel = 'gemini-2.5-flash';
    if (blog_id) {
      const { data: prefs } = await supabase
        .from('content_preferences')
        .select('ai_model_text')
        .eq('blog_id', blog_id)
        .maybeSingle();
      
      if (prefs?.ai_model_text) {
        textModel = prefs.ai_model_text;
        console.log(`Using configured text model: ${textModel}`);
      }
    }

    // ========== BUSCAR CONTEXTO DO NEGÓCIO ==========
    let businessContext: BusinessContext = {
      company_name: 'a empresa',
      niche: 'serviços',
      city: '',
      services: [],
      region: '',
      cta_channel: 'WhatsApp'
    };

    if (blog_id) {
      // Buscar business_profile
      const { data: profile } = await supabase
        .from('business_profile')
        .select('company_name, niche, city, long_description')
        .eq('blog_id', blog_id)
        .maybeSingle();
      
      // Buscar client_strategy para mais contexto
      const { data: strategy } = await supabase
        .from('client_strategy')
        .select('empresa_nome, tipo_negocio, regiao_atuacao, o_que_oferece, canal_cta, principais_beneficios')
        .eq('blog_id', blog_id)
        .maybeSingle();

      if (profile || strategy) {
        businessContext = {
          company_name: profile?.company_name || strategy?.empresa_nome || 'a empresa',
          niche: profile?.niche || strategy?.tipo_negocio || 'serviços',
          city: profile?.city || '',
          services: strategy?.principais_beneficios || [],
          region: strategy?.regiao_atuacao || profile?.city || '',
          cta_channel: strategy?.canal_cta || 'WhatsApp'
        };
        console.log(`[BUSINESS CONTEXT] Loaded: ${businessContext.company_name} (${businessContext.niche})`);
      }
    }

    // ========== GERAR KEYWORDS AUTOMATICAMENTE SE VAZIAS ==========
    let finalKeywords = keywords || [];
    let keywordsWereGenerated = false;
    
    if (finalKeywords.length === 0 || (finalKeywords.length === 1 && !finalKeywords[0])) {
      const theme = articleTitle || 'artigo';
      const autoKeywords = generateAutoKeywords(theme, {
        niche: businessContext.niche,
        city: businessContext.city,
        services: businessContext.services
      });
      finalKeywords = [autoKeywords.primary, ...autoKeywords.secondary];
      keywordsWereGenerated = true;
      console.log(`[AUTO-KEYWORDS] Generated: ${finalKeywords.join(', ')}`);
      
      // Persist auto-generated keywords to the article
      if (article_id) {
        const { error: updateError } = await supabase
          .from('articles')
          .update({ keywords: finalKeywords })
          .eq('id', article_id);
        
        if (updateError) {
          console.warn(`[AUTO-KEYWORDS] Failed to persist to article: ${updateError.message}`);
        } else {
          console.log(`[AUTO-KEYWORDS] Persisted to article ${article_id}`);
        }
      }
    }

    const keywordList = finalKeywords.join(', ');
    const mainKeyword = finalKeywords[0];

    // Extract images and headings BEFORE AI processing (for guardrails)
    const originalImages = type === 'content' || type === 'density' 
      ? extractImageUrls(currentValue || '')
      : [];
    const originalHeadings = type === 'content' || type === 'density'
      ? extractHeadings(currentValue || '')
      : [];
    
    if (originalImages.length > 0) {
      console.log(`[GUARDRAIL] Found ${originalImages.length} images to preserve`);
    }
    if (originalHeadings.length > 0) {
      console.log(`[GUARDRAIL] Found ${originalHeadings.length} headings to preserve`);
    }

    // ========== CONSTRUIR PROMPTS COM EDITOR PROFISSIONAL ==========
    const systemPrompt = buildSEOEditorSystemPrompt(businessContext);

    let userPrompt = '';

    switch (type) {
      case 'title':
        userPrompt = `Otimize este título para SEO.

Título atual: "${currentValue}"
Palavra-chave principal: "${mainKeyword}"
Palavras-chave secundárias: ${keywordList}

Requisitos:
- Inclua a palavra-chave principal "${mainKeyword}" preferencialmente no início
- Mantenha entre 50-60 caracteres
- Seja atraente e clicável
- Mantenha o tema original do título

Responda APENAS com o novo título, sem aspas ou explicações.`;
        break;

      case 'meta':
        userPrompt = `Crie uma meta description otimizada para SEO.

Meta description atual: "${currentValue || 'Vazia'}"
Título do artigo: "${articleTitle || 'Não informado'}"
Palavra-chave principal: "${mainKeyword}"
Palavras-chave: ${keywordList}

Requisitos:
- Inclua a palavra-chave principal "${mainKeyword}" naturalmente
- Mantenha entre 140-160 caracteres
- Seja persuasivo e inclua uma chamada para ação
- Descreva o valor do conteúdo para o leitor

Responda APENAS com a nova meta description, sem aspas ou explicações.`;
        break;

      case 'content':
        // Calculate dynamic expansion target
        const currentWords = wordCount || Math.round((currentValue?.length || 0) / 6);
        const targetWords = targetWordCount || 1500;
        
        userPrompt = buildContentExpansionPrompt(
          businessContext,
          currentWords,
          targetWords,
          finalKeywords,
          currentValue || ''
        );
        break;

      case 'density':
        const densityCurrentWords = wordCount || Math.round((currentValue?.length || 0) / 6);
        
        userPrompt = buildDensityOptimizationPrompt(
          businessContext,
          densityCurrentWords,
          finalKeywords,
          currentValue || ''
        );
        break;

      default:
        throw new Error(`Unknown improvement type: ${type}`);
    }

    console.log(`Improving SEO item: ${type} with keywords: ${keywordList}, model: ${textModel}`);
    console.log(`Business context: ${businessContext.company_name} (${detectConclusionType(businessContext.niche)})`);

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        // Authorization handled by omniseen-ai.ts internally,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: textModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: type === 'content' || type === 'density' ? 8000 : 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API Error:', errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    let improvedValue = data.choices?.[0]?.message?.content?.trim();

    if (!improvedValue) {
      throw new Error('No response from AI');
    }

    // GUARDRAILS: Validate and restore images if needed
    let warning = null;
    if ((type === 'content' || type === 'density') && originalImages.length > 0) {
      const improvedImages = extractImageUrls(improvedValue);
      const missingImages = originalImages.filter(url => !improvedImages.includes(url));
      
      if (missingImages.length > 0) {
        console.warn(`[GUARDRAIL] ${missingImages.length} images were removed by AI, attempting restoration...`);
        
        // Attempt to restore missing images
        for (const imgUrl of missingImages) {
          // Find original image tag from the source content
          const imgRegex = new RegExp(`<img[^>]*src=["']${escapeRegex(imgUrl)}["'][^>]*>`, 'i');
          const imgMatch = (currentValue || '').match(imgRegex);
          
          if (imgMatch) {
            // Add the image at the end of content (better than losing it)
            improvedValue = improvedValue + '\n\n' + imgMatch[0];
            console.log(`[GUARDRAIL] Restored image: ${imgUrl.substring(0, 60)}...`);
          }
        }
        
        warning = `${missingImages.length} imagem(ns) restaurada(s) automaticamente`;
      }
    }

    console.log(`SEO improvement completed for ${type}`);

    // Log consumption if user_id provided
    if (user_id) {
      try {
        const inputTokens = Math.ceil((currentValue?.length || 0) / 4);
        const outputTokens = Math.ceil((improvedValue?.length || 0) / 4);

        await supabase.from("consumption_logs").insert({
          user_id,
          blog_id: blog_id || null,
          action_type: "seo_improvement",
          action_description: `SEO ${type}: ${articleTitle?.substring(0, 50) || 'improvement'}`,
          model_used: textModel,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          images_generated: 0,
          estimated_cost_usd: (inputTokens * 0.00000015) + (outputTokens * 0.0000006),
          metadata: { type, keywords: finalKeywords, business: businessContext.company_name },
        });
        console.log("Consumption logged for SEO improvement");
      } catch (logError) {
        console.warn("Failed to log consumption:", logError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        type,
        originalValue: currentValue,
        improvedValue,
        ...(warning && { warning }),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error improving SEO item:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
