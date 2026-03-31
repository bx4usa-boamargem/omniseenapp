import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateText, generateImage } from '../_shared/omniseen-ai.ts';


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ArticleInput {
  id: string;
  title: string;
  meta_description: string | null;
  content: string | null;
  keywords: string[] | null;
}

interface SuggestionOutput {
  articleId: string;
  originalValue: string;
  suggestedValue: string;
  improvement: string;
  predictedImpact: 'high' | 'medium' | 'low';
}

// Optimized prompts for concise JSON output
const PROMPTS: Record<string, string> = {
  title: `Você é um especialista em SEO. Otimize títulos de artigos para melhor CTR.

REGRAS ABSOLUTAS:
- Responda APENAS JSON válido, SEM markdown, SEM texto antes ou depois
- Títulos entre 50-60 caracteres
- Use números quando apropriado (ex: "7 Dicas...")
- Campo "improvement" máximo 8 palavras

FORMATO OBRIGATÓRIO (array JSON puro):
[{"articleId":"ID","originalValue":"título atual","suggestedValue":"título otimizado","improvement":"motivo breve","predictedImpact":"high"}]`,

  meta: `Você é um especialista em SEO. Crie meta descriptions otimizadas.

REGRAS ABSOLUTAS:
- Responda APENAS JSON válido, SEM markdown, SEM texto antes ou depois
- Meta descriptions entre 140-160 caracteres
- Inclua call-to-action
- Campo "improvement" máximo 8 palavras

FORMATO OBRIGATÓRIO (array JSON puro):
[{"articleId":"ID","originalValue":"descrição atual","suggestedValue":"nova descrição","improvement":"motivo breve","predictedImpact":"high"}]`,

  keywords: `Você é um especialista em SEO. Sugira palavras-chave estratégicas.

REGRAS ABSOLUTAS:
- Responda APENAS JSON válido, SEM markdown, SEM texto antes ou depois
- Sugira 3-5 keywords separadas por vírgula
- Inclua variações long-tail
- Campo "improvement" máximo 8 palavras

FORMATO OBRIGATÓRIO (array JSON puro):
[{"articleId":"ID","originalValue":"keywords atuais","suggestedValue":"keyword1, keyword2, keyword3","improvement":"motivo breve","predictedImpact":"high"}]`,

  density: `Você é um especialista em SEO. Analise a densidade de palavras-chave.

REGRAS ABSOLUTAS:
- Responda APENAS JSON válido, SEM markdown, SEM texto antes ou depois
- Identifique trechos para melhorar
- Densidade ideal 0.5% a 2.5%
- Campo "improvement" máximo 8 palavras

FORMATO OBRIGATÓRIO (array JSON puro):
[{"articleId":"ID","originalValue":"trecho atual","suggestedValue":"trecho otimizado","improvement":"motivo breve","predictedImpact":"medium"}]`,

  content: `Você é um especialista em SEO e conteúdo. Sugira expansões estruturais.

REGRAS ABSOLUTAS:
- Responda APENAS JSON válido, SEM markdown, SEM texto antes ou depois
- Sugira 2-3 novas seções H2/H3
- Seja específico e prático
- Campo "improvement" máximo 8 palavras

FORMATO OBRIGATÓRIO (array JSON puro):
[{"articleId":"ID","originalValue":"resumo do conteúdo","suggestedValue":"[H2] Nova Seção 1, [H2] Nova Seção 2","improvement":"motivo breve","predictedImpact":"high"}]`
};

// Process a batch of articles
async function processArticleBatch(
  articles: ArticleInput[],
  type: string,
  systemPrompt: string,
  apiKey: string
): Promise<SuggestionOutput[]> {
  const articlesData = articles.map((a: ArticleInput) => {
    const data: Record<string, any> = {
      id: a.id,
      title: a.title
    };

    if (type === 'meta') {
      data.meta_description = a.meta_description || '';
      data.content_preview = (a.content || '').substring(0, 300);
    } else if (type === 'keywords') {
      data.current_keywords = a.keywords?.join(', ') || '';
      data.content_preview = (a.content || '').substring(0, 500);
    } else if (type === 'density' || type === 'content') {
      data.keywords = a.keywords?.join(', ') || '';
      data.content = (a.content || '').substring(0, 1500);
    }

    return data;
  });

  console.log(`[Batch] Processing ${articles.length} articles for ${type}`);

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Analise estes ${articles.length} artigos e gere sugestões de otimização. Responda APENAS o array JSON:\n\n${JSON.stringify(articlesData, null, 2)}`
        }
      ],
      temperature: 0.3, // Lower temperature for more consistent JSON
      max_tokens: 4000 // Per batch, not total
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI Gateway error:', response.status, errorText);
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const aiResponse = await response.json();
  const content = aiResponse.choices?.[0]?.message?.content || '';

  console.log('[Batch] Raw AI response length:', content.length);

  return parseAIResponse(content, articles);
}

// Robust JSON parser with multiple fallback strategies
function parseAIResponse(content: string, articles: ArticleInput[]): SuggestionOutput[] {
  console.log('[Parser] Starting to parse AI response...');
  
  // Step 1: Clean markdown code blocks
  let cleanContent = content
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .replace(/^\s*[\r\n]+/, '') // Remove leading whitespace/newlines
    .trim();

  console.log('[Parser] Cleaned content length:', cleanContent.length);

  // Step 2: Try direct JSON parse
  try {
    // Find JSON array in the content
    const arrayStart = cleanContent.indexOf('[');
    const arrayEnd = cleanContent.lastIndexOf(']');
    
    if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
      const jsonStr = cleanContent.substring(arrayStart, arrayEnd + 1);
      const parsed = JSON.parse(jsonStr);
      
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log('[Parser] Successfully parsed JSON array with', parsed.length, 'items');
        return validateAndNormalizeSuggestions(parsed, articles);
      }
    }
  } catch (e) {
    console.warn('[Parser] Direct JSON parse failed:', (e as Error).message);
  }

  // Step 3: Try to fix common JSON issues
  try {
    let fixedContent = cleanContent;
    
    // Fix unterminated strings by finding the last complete object
    const lastCompleteObject = fixedContent.lastIndexOf('}');
    if (lastCompleteObject !== -1) {
      fixedContent = fixedContent.substring(0, lastCompleteObject + 1) + ']';
    }
    
    // Ensure it starts with [
    if (!fixedContent.trim().startsWith('[')) {
      const arrayStart = fixedContent.indexOf('[');
      if (arrayStart !== -1) {
        fixedContent = fixedContent.substring(arrayStart);
      }
    }
    
    const parsed = JSON.parse(fixedContent);
    if (Array.isArray(parsed) && parsed.length > 0) {
      console.log('[Parser] Fixed JSON parsed with', parsed.length, 'items');
      return validateAndNormalizeSuggestions(parsed, articles);
    }
  } catch (e) {
    console.warn('[Parser] Fixed JSON parse also failed:', (e as Error).message);
  }

  // Step 4: Extract individual objects using regex
  console.log('[Parser] Attempting regex extraction...');
  const suggestions: SuggestionOutput[] = [];
  
  // Match individual suggestion objects
  const objectPattern = /\{[^{}]*"articleId"\s*:\s*"([^"]+)"[^{}]*"suggestedValue"\s*:\s*"([^"]*)"[^{}]*\}/g;
  let match;
  
  while ((match = objectPattern.exec(cleanContent)) !== null) {
    try {
      const fullMatch = match[0];
      // Try to parse the individual object
      const obj = JSON.parse(fullMatch);
      
      if (obj.articleId && obj.suggestedValue) {
        // Find the original article
        const article = articles.find(a => a.id === obj.articleId);
        
        suggestions.push({
          articleId: obj.articleId,
          originalValue: obj.originalValue || article?.title || '',
          suggestedValue: obj.suggestedValue,
          improvement: obj.improvement || 'Otimização IA',
          predictedImpact: obj.predictedImpact || 'medium'
        });
      }
    } catch (e) {
      // Skip this object
    }
  }

  if (suggestions.length > 0) {
    console.log('[Parser] Regex extraction found', suggestions.length, 'suggestions');
    return suggestions;
  }

  console.warn('[Parser] No suggestions could be extracted from response');
  return [];
}

// Validate and normalize suggestions
function validateAndNormalizeSuggestions(
  parsed: any[], 
  articles: ArticleInput[]
): SuggestionOutput[] {
  return parsed
    .filter(item => item && item.articleId && item.suggestedValue)
    .map(item => {
      const article = articles.find(a => a.id === item.articleId);
      return {
        articleId: item.articleId,
        originalValue: item.originalValue || article?.title || '',
        suggestedValue: item.suggestedValue,
        improvement: item.improvement || 'Otimização IA',
        predictedImpact: (['high', 'medium', 'low'].includes(item.predictedImpact) 
          ? item.predictedImpact 
          : 'medium') as 'high' | 'medium' | 'low'
      };
    });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
const { type, articles, blog_id, user_id } = await req.json();

    if (!type || !articles || !Array.isArray(articles) || articles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, articles' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = PROMPTS[type];
    if (!systemPrompt) {
      return new Response(
        JSON.stringify({ error: `Invalid optimization type: ${type}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Main] Starting ${type} optimization for ${articles.length} articles`);

    // Process in smaller batches to avoid truncation
    const BATCH_SIZE = 3;
    const allSuggestions: SuggestionOutput[] = [];
    let partialError = false;

    for (let i = 0; i < articles.length; i += BATCH_SIZE) {
      const batch = articles.slice(i, i + BATCH_SIZE);
      console.log(`[Main] Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(articles.length/BATCH_SIZE)}`);
      
      try {
        const batchSuggestions = await processArticleBatch(batch, type, systemPrompt, GOOGLE_AI_KEY);
        allSuggestions.push(...batchSuggestions);
        
        if (batchSuggestions.length === 0 && batch.length > 0) {
          console.warn(`[Main] Batch returned no suggestions, might have parsing issues`);
          partialError = true;
        }
      } catch (batchError) {
        console.error(`[Main] Batch error:`, batchError);
        partialError = true;
        
        // Check for rate limit or credits errors
        if (batchError instanceof Error) {
          if (batchError.message.includes('429')) {
            return new Response(
              JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
              { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          if (batchError.message.includes('402')) {
            return new Response(
              JSON.stringify({ error: 'Créditos de IA insuficientes. Adicione créditos ao seu workspace.' }),
              { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        // Continue with other batches
      }
      
      // Small delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < articles.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`[Main] Total suggestions generated: ${allSuggestions.length}`);

    return new Response(
      JSON.stringify({ 
        suggestions: allSuggestions,
        partialError: partialError && allSuggestions.length > 0,
        processed: articles.length,
        successCount: allSuggestions.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('batch-seo-suggestions error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
