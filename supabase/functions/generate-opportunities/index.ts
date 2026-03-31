import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateRequest {
  blogId: string;
  count?: number;
  competitors?: { name: string; url: string }[];
  mode?: 'standard' | 'trends' | 'competitor_gaps';
  useTrends?: boolean;
  signalId?: string; // NEW: Link to omnicore_signals
  territory?: string; // NEW: Territory for OmniCore
}

interface RelevanceFactors {
  keyword_match: { score: number; matched: string[] };
  pain_alignment: { score: number; matched: string[] };
  desire_alignment: { score: number; matched: string[] };
  high_volume_keywords: { score: number; matched: string[] };
}

function calculateScore(
  title: string,
  keywords: string[],
  profile: Record<string, unknown> | null,
  highVolumeKeywords: Array<{ keyword: string; search_volume: number | null }>
): { score: number; factors: RelevanceFactors } {
  const relevanceFactors: RelevanceFactors = {
    keyword_match: { score: 0, matched: [] },
    pain_alignment: { score: 0, matched: [] },
    desire_alignment: { score: 0, matched: [] },
    high_volume_keywords: { score: 0, matched: [] },
  };

  const titleLower = title.toLowerCase();
  const keywordsLower = keywords.map(k => k.toLowerCase());
  const allTerms = [titleLower, ...keywordsLower];

  // 1. Match with brand keywords (0-25 pts)
  const brandKeywords = (profile?.brand_keywords as string[]) || [];
  const matchedBrandKeywords: string[] = [];
  
  for (const bk of brandKeywords) {
    const bkLower = bk.toLowerCase();
    if (allTerms.some(term => term.includes(bkLower) || bkLower.includes(term.split(' ')[0]))) {
      matchedBrandKeywords.push(bk);
    }
  }
  
  if (brandKeywords.length > 0) {
    const matchRatio = matchedBrandKeywords.length / Math.min(brandKeywords.length, 5);
    relevanceFactors.keyword_match.score = Math.round(matchRatio * 25);
    relevanceFactors.keyword_match.matched = matchedBrandKeywords;
  }

  // 2. Alignment with pain points (0-25 pts)
  const painPoints = (profile?.pain_points as string[]) || [];
  const matchedPains: string[] = [];
  
  for (const pain of painPoints) {
    const painWords = pain.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (painWords.some(pw => allTerms.some(term => term.includes(pw)))) {
      matchedPains.push(pain);
    }
  }
  
  if (painPoints.length > 0) {
    const matchRatio = matchedPains.length / Math.min(painPoints.length, 5);
    relevanceFactors.pain_alignment.score = Math.round(matchRatio * 25);
    relevanceFactors.pain_alignment.matched = matchedPains;
  }

  // 3. Alignment with desires (0-25 pts)
  const desires = (profile?.desires as string[]) || [];
  const matchedDesires: string[] = [];
  
  for (const desire of desires) {
    const desireWords = desire.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (desireWords.some(dw => allTerms.some(term => term.includes(dw)))) {
      matchedDesires.push(desire);
    }
  }
  
  if (desires.length > 0) {
    const matchRatio = matchedDesires.length / Math.min(desires.length, 5);
    relevanceFactors.desire_alignment.score = Math.round(matchRatio * 25);
    relevanceFactors.desire_alignment.matched = matchedDesires;
  }

  // 4. High-volume keywords match (0-25 pts)
  const matchedHighVolume: string[] = [];
  
  for (const kw of highVolumeKeywords.slice(0, 20)) {
    const kwLower = kw.keyword.toLowerCase();
    if (allTerms.some(term => term.includes(kwLower) || kwLower.includes(term))) {
      matchedHighVolume.push(kw.keyword);
    }
  }
  
  if (highVolumeKeywords.length > 0) {
    const matchRatio = matchedHighVolume.length / Math.min(highVolumeKeywords.length, 10);
    relevanceFactors.high_volume_keywords.score = Math.round(matchRatio * 25);
    relevanceFactors.high_volume_keywords.matched = matchedHighVolume;
  }

  const totalScore = 
    relevanceFactors.keyword_match.score +
    relevanceFactors.pain_alignment.score +
    relevanceFactors.desire_alignment.score +
    relevanceFactors.high_volume_keywords.score;

  return { score: totalScore, factors: relevanceFactors };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const { blogId, count = 5, competitors = [], mode = 'standard', useTrends = false, signalId, territory }: GenerateRequest = await req.json();
    console.log('Generating opportunities for blog:', blogId, 'count:', count, 'mode:', mode, 'competitors:', competitors.length, 'signalId:', signalId);

    if (!blogId) {
      return new Response(
        JSON.stringify({ error: 'blogId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch signal data if signalId provided (OmniCore flow)
    let signalData = null;
    if (signalId) {
      const { data: signal } = await supabase
        .from('omnicore_signals')
        .select('*')
        .eq('id', signalId)
        .single();
      
      if (signal) {
        signalData = signal;
        console.log(`[OMNICORE] Using signal: ${signal.topic}`);
      }
    }

    // Fetch business profile for context
    const { data: profile } = await supabase
      .from('business_profile')
      .select('*')
      .eq('blog_id', blogId)
      .single();

    // Fetch existing opportunities to avoid duplicates
    const { data: existingOpportunities } = await supabase
      .from('article_opportunities')
      .select('suggested_title')
      .eq('blog_id', blogId);

    const existingTitles = existingOpportunities?.map(o => o.suggested_title) || [];

    // Fetch existing articles to avoid duplicates
    const { data: existingArticles } = await supabase
      .from('articles')
      .select('title')
      .eq('blog_id', blogId);

    const existingArticleTitles = existingArticles?.map(a => a.title) || [];
    const allExisting = [...existingTitles, ...existingArticleTitles];

    // Fetch competitors from database if not provided
    let competitorsData = competitors;
    if (competitors.length === 0 && (mode === 'competitor_gaps' || mode === 'trends')) {
      const { data: dbCompetitors } = await supabase
        .from('competitors')
        .select('name, url')
        .eq('blog_id', blogId)
        .eq('is_active', true);
      
      if (dbCompetitors) {
        competitorsData = dbCompetitors;
      }
    }

    // Fetch high-volume keywords
    const { data: keywordData } = await supabase
      .from('keyword_analyses')
      .select('keyword, search_volume')
      .eq('blog_id', blogId)
      .order('search_volume', { ascending: false })
      .limit(20);

    const highVolumeKeywords = keywordData || [];

    // Build context from business profile
    const niche = profile?.niche || 'negócios em geral';
    const targetAudience = profile?.target_audience || 'empreendedores';
    const companyName = profile?.company_name || '';
    const concepts = (profile?.concepts as string[])?.join(', ') || '';
    const painPoints = (profile?.pain_points as string[])?.join(', ') || '';
    const desires = (profile?.desires as string[])?.join(', ') || '';

    // Build mode-specific context
    let modeContext = '';
    let trendSource = 'ai';

    if (mode === 'trends') {
      trendSource = 'trends';
      const topKeywords = highVolumeKeywords.slice(0, 10);
      modeContext = `
MODO: TENDÊNCIAS E ALTO VOLUME
Foque em criar artigos baseados nestas tendências e keywords de alto volume:
${topKeywords.map(k => `- ${k.keyword}${k.search_volume ? ` (${k.search_volume} buscas/mês)` : ''}`).join('\n')}

Crie títulos que aproveitem essas tendências enquanto permanecem relevantes para o nicho.
`;
    } else if (mode === 'competitor_gaps') {
      trendSource = 'competitors';
      modeContext = `
MODO: GAPS DE CONCORRENTES
Analise os concorrentes e sugira artigos para cobrir lacunas de conteúdo:
${competitorsData.map(c => `- ${c.name}: ${c.url}`).join('\n')}

Sugira temas que os concorrentes provavelmente cobrem, mas com um ângulo único e diferenciado.
`;
    }

    // Build competitors context for standard mode
    const competitorsContext = competitorsData.length > 0 && mode === 'standard'
      ? `\n\nCONCORRENTES CADASTRADOS:\n${competitorsData.map(c => `- ${c.name}: ${c.url}`).join('\n')}\n\nConsidere os nichos desses concorrentes ao sugerir artigos.`
      : '';

    const systemPrompt = `Você é a OMNISEEN AI, a assistente virtual inteligente da OMNISEEN, estrategista de conteúdo especializada em SEO e marketing digital.
Sua tarefa é sugerir títulos de artigos relevantes e atrativos para um blog.

CONTEXTO DO NEGÓCIO:
- Nicho: ${niche}
- Público-alvo: ${targetAudience}
${companyName ? `- Empresa: ${companyName}` : ''}
${concepts ? `- Conceitos importantes: ${concepts}` : ''}
${painPoints ? `- Dores do público: ${painPoints}` : ''}
${desires ? `- Desejos do público: ${desires}` : ''}${competitorsContext}
${modeContext}

REGRAS:
- Crie títulos em português brasileiro
- Foque em dores e desejos reais do público-alvo
- Títulos devem ser claros, diretos e com potencial de SEO
- Evite títulos genéricos, prefira específicos e práticos
- Cada sugestão deve incluir 3-5 palavras-chave relevantes
- NÃO repita títulos já existentes
${mode === 'trends' ? '- Priorize tendências e termos de alto volume de busca' : ''}
${mode === 'competitor_gaps' ? '- Identifique oportunidades que os concorrentes podem estar explorando' : ''}

TÍTULOS JÁ EXISTENTES (NÃO REPETIR):
${allExisting.slice(0, 20).join('\n')}`;

    const userPrompt = `Gere exatamente ${count} sugestões de artigos para o blog.

Responda APENAS com um JSON válido no formato:
{
  "suggestions": [
    {
      "title": "Título do artigo aqui",
      "keywords": ["palavra1", "palavra2", "palavra3"]
    }
  ]
}`;

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        // Authorization handled by omniseen-ai.ts internally,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorText = await response.text();
      console.error('AI Gateway error:', status, errorText);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos à sua conta Lovable.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error('AI service error');
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Empty response from AI');
    }

    // Parse the JSON response
    let suggestions;
    try {
      const parsed = JSON.parse(content);
      suggestions = parsed.suggestions || [];
    } catch (e) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }

    // Calculate relevance score for each suggestion and prepare for insert
    const opportunitiesToInsert = suggestions.map((s: { title: string; keywords: string[] }) => {
      const { score, factors } = calculateScore(s.title, s.keywords || [], profile, highVolumeKeywords);
      
      return {
        blog_id: blogId,
        suggested_title: s.title,
        suggested_keywords: s.keywords || [],
        status: 'pending',
        source: trendSource,
        trend_source: trendSource,
        relevance_score: score,
        relevance_factors: factors,
      };
    });

    if (opportunitiesToInsert.length > 0) {
      const { data: insertedData, error: insertError } = await supabase
        .from('article_opportunities')
        .insert(opportunitiesToInsert)
        .select();

      if (insertError) {
        console.error('Error inserting opportunities:', insertError);
        throw new Error('Failed to save opportunities');
      }

      // ============================================
      // OMNICORE: Save to omnicore_opportunities if signalId present
      // ============================================
      if (signalId && insertedData) {
        console.log(`[OMNICORE] Saving ${insertedData.length} opportunities to omnicore_opportunities...`);
        
        for (const opp of insertedData) {
          const omnicoreOpp = {
            blog_id: blogId,
            signal_id: signalId,
            opportunity_id: opp.id,
            territory: territory || signalData?.territory || 'Unknown',
            slug: opp.suggested_title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60) || null,
            title: opp.suggested_title,
            angle: 'local-authority',
            primary_kw: opp.suggested_keywords?.[0] || null,
            secondary_kw: opp.suggested_keywords?.slice(1) || [],
            intent: 'informational',
            status: 'pending',
          };
          
          const { error: omnicoreError } = await supabase
            .from('omnicore_opportunities')
            .insert(omnicoreOpp);
          
          if (omnicoreError) {
            console.warn(`[OMNICORE] Failed to save opportunity:`, omnicoreError);
          }
        }
        
        console.log(`[OMNICORE] Saved opportunities to omnicore_opportunities`);
      }

      // Check for high-relevance opportunities and send notifications
      const highRelevanceOpps = insertedData?.filter(opp => opp.relevance_score >= 70) || [];
      
      for (const opp of highRelevanceOpps) {
        try {
          await supabase.functions.invoke('send-opportunity-notification', {
            body: {
              opportunityId: opp.id,
              blogId: opp.blog_id,
              title: opp.suggested_title,
              score: opp.relevance_score,
              keywords: opp.suggested_keywords || [],
            }
          });
        } catch (notifError) {
          console.error('Error sending notification:', notifError);
        }
      }
    }

    console.log(`Generated ${opportunitiesToInsert.length} opportunities with mode: ${mode}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: opportunitiesToInsert.length,
        opportunities: opportunitiesToInsert,
        mode,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-opportunities:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao gerar oportunidades' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
