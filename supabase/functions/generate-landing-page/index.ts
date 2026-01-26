import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GenerateRequest {
  blog_id: string;
  niche?: string;
  city?: string;
  company_name?: string;
  services?: string[];
  phone?: string;
  whatsapp?: string;
  address?: string;
  email?: string;
  territories?: string[];
  differentiator?: string;
  target_audience?: string;
}

type SerpMatrixLite = {
  commonTerms?: string[];
  topTitles?: string[];
  contentGaps?: string[];
  competitors?: Array<{ url: string; title: string }>;
};

function buildSerpPack(matrix: SerpMatrixLite | null) {
  const topTerms = (matrix?.commonTerms || []).slice(0, 12);
  const topTitles = (matrix?.topTitles || []).slice(0, 3);
  const gaps = (matrix?.contentGaps || []).slice(0, 6);
  const competitors = (matrix?.competitors || []).slice(0, 5).map(c => c.url).filter(Boolean);
  return { topTerms, topTitles, gaps, competitors };
}

const SERVICE_AUTHORITY_PROMPT = `
Você é um Especialista em Conversão Local e SEO. Sua tarefa é gerar o page_data para uma "Super Página" de alta performance.
Siga fielmente o layout de empresas líderes de mercado (ex: Roofing in Chicago).

ESTRUTURA OBRIGATÓRIA:
1. HERO: Headline com [Serviço] em [Cidade]. CTA secundário logo abaixo.
2. CALL TO ACTION GIGANTE: Número de telefone em destaque (Call Now).
3. SERVICE CARDS: No mínimo 3 cards. Cada um com: Título, Descrição curta e Botão de Ação específico.
4. EMERGENCY BLOCK: Banner de urgência para problemas imediatos.
5. AUTHORITY CONTENT: Texto longo (800+ palavras) estruturado em H2/H3 usando os termos de SEO fornecidos.
6. WHY CHOOSE US: Lista de benefícios reais e prova de confiança.

REGRAS VISUAIS:
- Use parágrafos curtos.
- Foque em botões de ação claros.
- Gere prompts de imagem realistas para os cards (trabalhadores reais, ferramentas, contexto urbano).
`;

const SERVICE_AUTHORITY_SCHEMA_PROMPT = `
Você deve gerar um JSON estrito para o template "service_authority_v1".
REGRAS DE CONTEÚDO:
- Hero: Headline focada em benefício + Cidade.
- Call Now: Destaque o telefone.
- Services: Mínimo 3 cards. CADA UM deve ter um "image_prompt" detalhado (estilo fotorealista, trabalhador real, ferramentas, sem anime).
- Authority Content: 1600-2200 palavras. Estrutura H2/H3 rica. Incorpore no mínimo 8 prompts de imagem fotográfica no meio do texto.
- Nada de emojis ou ilustrações.

ESTRUTURA DO JSON:
{
  "template": "service_authority_v1",
  "brand": { "company_name": "...", "phone": "...", "city": "...", "service": "..." },
  "hero": { "headline": "...", "subheadline": "...", "image_prompt": "photorealistic professional photo of..." },
  "services": [{ "title": "...", "desc": "...", "cta": "Schedule", "image_prompt": "photorealistic photo of..." }],
  "emergency": { "headline": "Need Urgent Help?", "subtext": "Available 24/7" },
  "authority_content": "<h2>...</h2><p>...</p>",
  "faq": [{ "question": "...", "answer": "..." }]
}
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Research is mandatory for Super Page quality. analyze-serp relies on Perplexity.
    if (!PERPLEXITY_API_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "RESEARCH_REQUIRED",
          message: "PERPLEXITY_API_KEY não configurada. Pesquisa SERP é obrigatória para Super Páginas."
        }),
        { status: 424, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: GenerateRequest = await req.json();
    const { blog_id } = body;

    if (!blog_id) {
      return new Response(
        JSON.stringify({ error: "blog_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch business profile context
    const { data: profile } = await supabase
      .from("business_profile")
      .select("*")
      .eq("blog_id", blog_id)
      .single();

    // Fetch territories
    const { data: territories } = await supabase
      .from("territories")
      .select("city, neighborhood, scope, state")
      .eq("blog_id", blog_id)
      .eq("is_active", true);

    // Build context from profile and request
    const niche = body.niche || profile?.services?.split(",")[0]?.trim() || "serviços profissionais";
    const city = body.city || profile?.city || "sua cidade";
    const companyName = body.company_name || profile?.company_name || "Nossa Empresa";
    const services = body.services || profile?.services?.split(",").map((s: string) => s.trim()) || [];
    const phone = body.phone || (profile as any)?.phone || "";
    const whatsapp = body.whatsapp || (profile as any)?.whatsapp || phone;
    const address = body.address || (profile as any)?.address || "";
    const email = body.email || "";
    const differentiator = body.differentiator || (profile as any)?.differentiator || "";
    const targetAudience = body.target_audience || profile?.target_audience || "";

    // Build neighborhoods list from territories
    const neighborhoods = territories?.map(t => (t as any).neighborhood).filter(Boolean) || [];

    // -------------------------------------------------------------------------
    // Research (SERP + competitors) - deterministic pack from analyze-serp
    // -------------------------------------------------------------------------
    const keyword = `${niche} em ${city}`;

    const researchStart = Date.now();
    const serpRes = await fetch(`${SUPABASE_URL}/functions/v1/analyze-serp`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keyword,
        territory: city,
        blogId: blog_id,
        forceRefresh: false,
        useFirecrawl: true,
      }),
    });

    if (!serpRes.ok) {
      const t = await serpRes.text().catch(() => '');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'RESEARCH_FAILED',
          message: `Falha ao analisar SERP (analyze-serp): ${serpRes.status} ${t.substring(0, 200)}`
        }),
        { status: 424, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const serpJson = await serpRes.json();
    const matrix: SerpMatrixLite | null = serpJson?.matrix || null;
    const serpPack = buildSerpPack(matrix);
    const researchMs = Date.now() - researchStart;

    // -------------------------------------------------------------------------
    // Super Page generation (LP JSON) - compact prompts to avoid context overflow
    // -------------------------------------------------------------------------
    const systemPrompt = `Você é um especialista em criação de SUPER PÁGINAS (landing pages) para negócios locais.

Objetivo: gerar uma página que RANQUEIA e CONVERTE.

REGRAS:
- Português BR.
- Específico para NICHO + CIDADE.
- Copie a INTENÇÃO do SERP (sem copiar texto).
- Use termos/entidades do SERP naturalmente.
- CTAs fortes e claros.
- Inclua bairros/regiões quando houver.
- FAQs reais.

ENTRADA SERP (obrigatória):
- Títulos top: ${serpPack.topTitles.join(' | ') || 'N/A'}
- Entidades/termos: ${serpPack.topTerms.join(', ') || 'N/A'}
- Gaps: ${serpPack.gaps.join(' | ') || 'N/A'}
- Concorrentes (URLs): ${serpPack.competitors.join(' | ') || 'N/A'}

Retorne APENAS JSON válido no schema esperado (hero, services, service_details, testimonials, areas_served, faq, contact, cta_banner).`;

    const userPrompt = `Crie uma SUPER PÁGINA para:

EMPRESA: ${companyName}
QUERY (keyword): ${keyword}
NICHO: ${niche}
CIDADE: ${city}
SERVIÇOS: ${services.join(", ") || "Não especificados"}
TELEFONE: ${phone}
WHATSAPP: ${whatsapp}
ENDEREÇO: ${address || "Não especificado"}
DIFERENCIAL: ${differentiator || "Qualidade e profissionalismo"}
PÚBLICO-ALVO: ${targetAudience || "Clientes locais"}
BAIRROS ATENDIDOS: ${neighborhoods.slice(0, 12).join(", ") || "Toda a cidade"}

Requisitos mínimos:
- 3+ serviços
- 4+ diferenciais (why_choose_us)
- 3+ depoimentos
- 5+ FAQs
- Áreas atendidas com pelo menos 2 regiões

IDs podem ser strings simples. Não use markdown.`;

    const aiStart = Date.now();

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[generate-landing-page] AI error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content received from AI");
    }

    // Parse JSON from AI response
    let pageData;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        pageData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("[generate-landing-page] JSON parse error:", parseError);
      throw new Error("Failed to parse AI response as JSON");
    }

    const aiMs = Date.now() - aiStart;

    // Log usage
    await supabase.from("ai_usage_logs").insert([
      {
        blog_id,
        provider: "perplexity",
        endpoint: "analyze-serp",
        cost_usd: 0.015,
        success: true,
        metadata: { keyword, city, niche, duration_ms: researchMs }
      },
      {
        blog_id,
        provider: "lovable_ai",
        endpoint: "generate-landing-page",
        cost_usd: 0.01,
        success: true,
        metadata: {
          model: "google/gemini-3-flash-preview",
          keyword,
          niche,
          city,
          services_count: services.length,
          duration_ms: aiMs,
        }
      }
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        page_data: pageData,
        context: {
          company_name: companyName,
          niche,
          city,
          services,
          keyword,
          serp: serpPack,
        },
        timings: {
          total_ms: Date.now() - startedAt,
          research_ms: researchMs,
          generation_ms: aiMs,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[generate-landing-page] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});