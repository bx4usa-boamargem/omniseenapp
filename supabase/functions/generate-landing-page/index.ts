import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type LandingPageTemplate = 'service_authority_v1' | 'service_authority_pro_v1' | 'institutional_v1' | 'specialist_authority_v1';

// Robust JSON parser that handles malformed AI responses
function robustJsonParse(raw: string): any {
  // Attempt 1: direct parse
  try { return JSON.parse(raw); } catch (_e) { /* continue */ }

  // Attempt 2: strip markdown fences, fix common issues
  let cleaned = raw
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .replace(/[\x00-\x1F\x7F]/g, ' ') // remove control chars
    .trim();

  // Fix trailing commas
  cleaned = cleaned.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

  // Extract first JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    let candidate = match[0];

    // Balance braces/brackets
    let braces = 0, brackets = 0;
    for (const ch of candidate) {
      if (ch === '{') braces++;
      if (ch === '}') braces--;
      if (ch === '[') brackets++;
      if (ch === ']') brackets--;
    }
    while (braces > 0) { candidate += '}'; braces--; }
    while (brackets > 0) { candidate += ']'; brackets--; }

    try { return JSON.parse(candidate); } catch (_e) { /* continue */ }

    // Attempt 3: truncate at last valid closing brace
    const lastBrace = candidate.lastIndexOf('}');
    if (lastBrace > 0) {
      try { return JSON.parse(candidate.substring(0, lastBrace + 1)); } catch (_e) { /* give up */ }
    }
  }

  throw new Error('Failed to parse AI JSON response after repair attempts');
}

// Helper functions for SEO field generation
function buildSeoTitle(pageData: any, companyName: string, niche: string, city: string): string {
  const heroHeadline = pageData.hero?.headline || pageData.hero?.title || '';
  if (heroHeadline.length >= 30 && heroHeadline.length <= 60) {
    return heroHeadline;
  }
  
  const parts = [companyName, niche, city].filter(Boolean);
  let title = parts.join(' - ');
  
  if (title.length > 60) {
    title = `${companyName} - ${niche}`.slice(0, 60);
  }
  
  if (title.length < 30 && city) {
    title = `${companyName}: ${niche} em ${city}`.slice(0, 60);
  }
  
  return title || `${companyName} - Serviços Profissionais`;
}

function buildSeoDescription(pageData: any, niche: string, city: string, companyName: string): string {
  const heroSubheadline = pageData.hero?.subheadline || pageData.hero?.subtitle || '';
  if (heroSubheadline.length >= 120 && heroSubheadline.length <= 160) {
    return heroSubheadline;
  }
  
  const cityPart = city ? ` em ${city}` : '';
  const description = `${companyName} oferece serviços de ${niche}${cityPart}. Atendimento profissional e qualidade garantida. Solicite seu orçamento grátis!`;
  
  return description.slice(0, 160);
}

function extractKeywords(pageData: any, niche: string, services: string[], city: string, companyName: string): string[] {
  const keywords = new Set<string>();
  
  if (niche) keywords.add(niche.toLowerCase());
  if (city) keywords.add(`${niche} ${city}`.toLowerCase());
  if (companyName) keywords.add(companyName.toLowerCase());
  
  services.slice(0, 3).forEach(service => {
    if (service) {
      keywords.add(service.toLowerCase().trim());
      if (city) {
        keywords.add(`${service} ${city}`.toLowerCase().trim());
      }
    }
  });
  
  const heroTitle = pageData.hero?.headline || pageData.hero?.title || '';
  if (heroTitle) {
    const words = heroTitle.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3);
    words.slice(0, 2).forEach((w: string) => keywords.add(w));
  }
  
  return Array.from(keywords).slice(0, 7);
}

function buildSlug(headline: string, niche: string, city: string): string {
  let base = headline || `${niche} ${city}` || 'landing-page';
  
  const slug = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
  
  return slug || 'super-pagina';
}

// PRO Template Prompt-Mestre para Imagens Fotorealistas
function buildProImagePrompt(niche: string, city: string, sectionName: string, sceneDescription: string): string {
  return `Photorealistic professional photography of ${sceneDescription} in ${city}, related to ${niche} services. Clean composition, natural lighting, commercial style, high detail, modern, trustworthy atmosphere, no text, no logos, no watermark.`;
}

// MEGA-PROMPT PRO - 12 seções, 15 imagens
const SERVICE_AUTHORITY_PRO_PROMPT = (company: string, niche: string, city: string, services: string[]) => `
Você é um Arquiteto de Landing Pages de Alta Conversão no padrão SEOwriting.ai.
Gere um JSON para o template "service_authority_pro_v1".

## MÉTRICAS OBRIGATÓRIAS
- 12 seções H2 distintas
- 15 image_prompts FOTOREALISTAS únicos
- 6+ CTAs distribuídos
- 1500+ palavras de conteúdo total
- Textos CONTROLADOS por bloco (ver limites)

## LIMITES DE TEXTO (INVIOLÁVEIS)
| Seção | Limite |
|-------|--------|
| Hero headline | 8-12 palavras |
| Hero subheadline | 20-30 palavras |
| Service Card desc | 40-60 palavras |
| Deep Dive intro | 50-80 palavras |
| Deep Dive bullets | 5-7 items por seção |
| Local challenge desc | 30-50 palavras |
| FAQ answer | 50-100 palavras |
| Inspection steps | 4-6 steps |

## CONTEXTO
- Empresa: ${company}
- Nicho: ${niche}
- Cidade: ${city}
- Serviços: ${services.join(', ')}

## REGRA DE IMAGE_PROMPT (PROMPT-MESTRE OBRIGATÓRIO)
Para CADA image_prompt, use EXATAMENTE este formato:
"Photorealistic professional photography of [CENA ESPECÍFICA] in ${city}, related to ${niche} services. Clean composition, natural lighting, commercial style, high detail, modern, trustworthy atmosphere, no text, no logos, no watermark."

Substitua [CENA ESPECÍFICA] por uma descrição contextual única para cada seção.

## ESTRUTURA JSON OBRIGATÓRIA (12 seções + 15 imagens)

{
  "template": "service_authority_pro_v1",
  "brand": {
    "company_name": "${company}",
    "phone": "(11) 99999-9999",
    "city": "${city}",
    "niche": "${niche}",
    "tagline": "Slogan profissional"
  },
  "hero": {
    "headline": "Headline de 8-12 palavras com benefício e cidade",
    "subheadline": "Subheadline de 20-30 palavras explicando o valor",
    "image_prompt": "Photorealistic..."
  },
  "service_cards": [
    {
      "id": "service-1",
      "title": "${services[0] || 'Serviço Principal'}",
      "description": "Descrição de 40-60 palavras sobre este serviço específico...",
      "cta_text": "Solicitar Orçamento",
      "image_prompt": "Photorealistic..."
    },
    {
      "id": "service-2",
      "title": "${services[1] || 'Serviço Secundário'}",
      "description": "Descrição de 40-60 palavras...",
      "cta_text": "Saiba Mais",
      "image_prompt": "Photorealistic..."
    },
    {
      "id": "service-3",
      "title": "${services[2] || 'Serviço Adicional'}",
      "description": "Descrição de 40-60 palavras...",
      "cta_text": "Agendar Visita",
      "image_prompt": "Photorealistic..."
    },
    {
      "id": "service-4",
      "title": "${services[3] || 'Serviço Extra'}",
      "description": "Descrição de 40-60 palavras...",
      "cta_text": "Ligar Agora",
      "image_prompt": "Photorealistic..."
    }
  ],
  "emergency": {
    "headline": "Urgência em ${niche}?",
    "subtext": "Atendimento 24 horas, 7 dias por semana. Ligue agora!"
  },
  "deep_dives": [
    {
      "id": "deep-1",
      "title": "Primeiro Tema Aprofundado",
      "intro": "Introdução de 50-80 palavras sobre este tema...",
      "hero_image_prompt": "Photorealistic wide shot...",
      "side_image_prompt": "Photorealistic close-up detail...",
      "bullets": ["Benefício 1", "Benefício 2", "Benefício 3", "Benefício 4", "Benefício 5"],
      "cta_text": "Solicitar Orçamento"
    },
    {
      "id": "deep-2",
      "title": "Segundo Tema Aprofundado",
      "intro": "Introdução de 50-80 palavras...",
      "hero_image_prompt": "Photorealistic...",
      "side_image_prompt": "Photorealistic...",
      "bullets": ["Benefício A", "Benefício B", "Benefício C", "Benefício D", "Benefício E"],
      "cta_text": "Agendar Consulta"
    }
  ],
  "local_context": {
    "title": "Por Que ${city} Precisa de ${niche} Especializado",
    "intro": "Introdução de 50-80 palavras sobre o contexto local...",
    "hero_image_prompt": "Photorealistic urban scene of ${city}...",
    "challenges": [
      {
        "id": "challenge-1",
        "title": "Desafio Local 1",
        "description": "Descrição de 30-50 palavras...",
        "image_prompt": "Photorealistic..."
      },
      {
        "id": "challenge-2",
        "title": "Desafio Local 2",
        "description": "Descrição de 30-50 palavras...",
        "image_prompt": "Photorealistic..."
      },
      {
        "id": "challenge-3",
        "title": "Desafio Local 3",
        "description": "Descrição de 30-50 palavras...",
        "image_prompt": "Photorealistic..."
      }
    ]
  },
  "inspection_process": {
    "title": "Nosso Processo de Avaliação",
    "intro": "Introdução de 40-60 palavras...",
    "steps": [
      "Passo 1: Agendamento",
      "Passo 2: Avaliação inicial",
      "Passo 3: Diagnóstico",
      "Passo 4: Proposta detalhada",
      "Passo 5: Execução"
    ],
    "image_prompt": "Photorealistic professional inspection...",
    "special_offer": "Avaliação Gratuita"
  },
  "materials_quality": {
    "title": "Materiais e Equipamentos de Qualidade",
    "description": "Descrição de 60-100 palavras sobre a qualidade dos materiais...",
    "image_prompt": "Photorealistic close-up of premium professional tools and materials..."
  },
  "areas_served": {
    "title": "Áreas Atendidas em ${city}",
    "intro": "Cobertura completa na região metropolitana",
    "neighborhoods": ["Centro", "Zona Norte", "Zona Sul", "Zona Leste", "Zona Oeste", "Região 1", "Região 2", "Região 3"]
  },
  "faq": [
    { "id": "faq-1", "question": "Pergunta frequente 1?", "answer": "Resposta de 50-100 palavras..." },
    { "id": "faq-2", "question": "Pergunta frequente 2?", "answer": "Resposta de 50-100 palavras..." },
    { "id": "faq-3", "question": "Pergunta frequente 3?", "answer": "Resposta de 50-100 palavras..." },
    { "id": "faq-4", "question": "Pergunta frequente 4?", "answer": "Resposta de 50-100 palavras..." },
    { "id": "faq-5", "question": "Pergunta frequente 5?", "answer": "Resposta de 50-100 palavras..." },
    { "id": "faq-6", "question": "Pergunta frequente 6?", "answer": "Resposta de 50-100 palavras..." }
  ],
  "testimonials": [
    { "id": "test-1", "quote": "Depoimento real e convincente...", "name": "João S.", "location": "${city}" },
    { "id": "test-2", "quote": "Outro depoimento...", "name": "Maria P.", "location": "${city}" },
    { "id": "test-3", "quote": "Terceiro depoimento...", "name": "Carlos R.", "location": "${city}" }
  ],
  "footer_cta": {
    "headline": "Pronto para Resolver Seu Problema?",
    "phone": "(11) 99999-9999",
    "badges": ["Atendimento 24h", "Garantia de Qualidade", "Orçamento Grátis"]
  }
}

## REGRAS CRÍTICAS
1. TODOS os image_prompt devem ser únicos e específicos ao contexto
2. NENHUM texto genérico ou placeholder
3. Conteúdo em português do Brasil
4. Cidade e nicho devem aparecer naturalmente no conteúdo
5. CTAs devem variar (não repetir "Saiba Mais" em todas as seções)

Retorne APENAS o JSON válido, sem markdown ou explicações.`;

// Template-specific prompts with photo_prompt for specialist
const TEMPLATE_PROMPTS: Record<LandingPageTemplate, (company: string, niche: string, city: string, services: string[]) => string> = {
  service_authority_pro_v1: SERVICE_AUTHORITY_PRO_PROMPT,
  
  service_authority_v1: (company, niche, city, services) => `Você é um Especialista em Landing Pages de Alta Conversão para Serviços Locais.
Gere um JSON para o template "service_authority_v1".
REGRAS:
- Use nomes reais de cidades e serviços.
- Crie um conteúdo longo (1200+ palavras) para authority_content em HTML.
- NÃO use emojis ou placeholders.
- Crie PROMPTS DE IMAGEM FOTOREALISTAS para Hero e cada Serviço.
- Tom: Profissional e confiável, focado em conversão local.

SCHEMA OBRIGATÓRIO:
{
  "template": "service_authority_v1",
  "brand": { "company_name": "${company}", "phone": "555-0199", "city": "${city}", "service": "${niche}" },
  "hero": { 
    "headline": "Professional ${niche} in ${city}", 
    "subheadline": "Top-rated experts serving your area with 24/7 support.",
    "image_prompt": "Photorealistic professional photography of a ${niche} specialist working in ${city}, natural lighting, high detail, 8k"
  },
  "services": [
    ${services.slice(0, 4).map((s, i) => `{ 
      "title": "${s}", 
      "desc": "High-quality professional service guaranteed.", 
      "cta": "Schedule Now", 
      "image_prompt": "Photorealistic close-up of ${niche} tools and professional hands working, industrial background"
    }`).join(',\n    ')}
  ],
  "emergency": { "headline": "Emergency ${niche} Needed?", "subtext": "We are available 24 hours a day, 7 days a week." },
  "authority_content": "<h2>Expert ${niche} Solutions</h2><p>Long editorial content for SEO...</p>",
  "faq": [{ "question": "How fast can you arrive?", "answer": "We offer rapid response within 2 hours." }]
}`,

  institutional_v1: (company, niche, city, services) => `Você é um Especialista em Páginas Institucionais Corporativas.
Gere um JSON para o template "institutional_v1".
REGRAS:
- Tom FORMAL e CORPORATIVO.
- Destaque história, credibilidade e tradição da empresa.
- Foco em B2B, parcerias e resultados comprovados.
- Crie conteúdo de autoridade (1500+ palavras) em HTML para SEO.
- NÃO use emojis ou linguagem informal.

SCHEMA OBRIGATÓRIO:
{
  "template": "institutional_v1",
  "brand": { 
    "company_name": "${company}", 
    "tagline": "Excelência em ${niche} desde [ano]",
    "founded_year": "2010",
    "city": "${city}",
    "phone": "555-0199"
  },
  "hero": { 
    "headline": "Liderança e Excelência em ${niche}", 
    "subheadline": "Soluções corporativas de alto impacto para empresas que buscam resultados.",
    "image_prompt": "Corporate professional photography of modern office building, executive meeting room, business atmosphere, 8k quality"
  },
  "about": {
    "mission": "Entregar soluções de ${niche} com excelência e compromisso com resultados.",
    "vision": "Ser referência nacional em ${niche} até 2030.",
    "values": ["Integridade", "Excelência", "Inovação", "Compromisso", "Transparência"],
    "history": "Fundada em ${city}, nossa empresa construiu uma trajetória sólida de mais de uma década atendendo clientes corporativos..."
  },
  "services_areas": [
    ${services.slice(0, 6).map(s => `{ "title": "${s}", "description": "Soluções especializadas com foco em resultados.", "icon": "briefcase" }`).join(',\n    ')}
  ],
  "cases": [
    { "title": "Projeto de Expansão", "result": "+150% crescimento", "client": "Empresa XYZ" },
    { "title": "Otimização Operacional", "result": "30% redução de custos", "client": "Grupo ABC" }
  ],
  "team": [
    { "name": "Carlos Silva", "role": "CEO & Fundador", "photo_prompt": "Professional corporate headshot of executive businessman" },
    { "name": "Ana Santos", "role": "Diretora Comercial", "photo_prompt": "Professional corporate headshot of businesswoman" }
  ],
  "contact": {
    "address": "${city} - Centro Empresarial",
    "phone": "555-0199",
    "email": "contato@${company.toLowerCase().replace(/\\s+/g, '')}.com.br",
    "hours": "Segunda a Sexta, 8h às 18h"
  },
  "authority_content": "<h2>${niche}: Nossa Expertise</h2><p>Conteúdo editorial longo para SEO corporativo...</p>"
}`,

  specialist_authority_v1: (company, niche, city, services) => `Você é um Especialista em Branding Pessoal e Páginas de Autoridade.
Gere um JSON para o template "specialist_authority_v1".
REGRAS:
- Foco no ESPECIALISTA como autoridade no assunto.
- Destaque credenciais, resultados e metodologia única.
- Tom de CONFIANÇA e EXPERTISE.
- Linguagem em primeira pessoa quando apropriado.
- Crie conteúdo de autoridade (1200+ palavras) em HTML.
- IMPORTANTE: Gere um photo_prompt profissional para o especialista.

SCHEMA OBRIGATÓRIO:
{
  "template": "specialist_authority_v1",
  "specialist": { 
    "name": "${company}",
    "title": "Especialista em ${niche}",
    "credentials": "MBA, 15+ anos de experiência",
    "photo_prompt": "Professional portrait photography of ${niche} consultant, business attire, confident smile, studio lighting, neutral background, 8k quality, photorealistic",
    "photo_url": null
  },
  "hero": { 
    "headline": "Transforme Resultados com Expertise Comprovada", 
    "subheadline": "Especialista em ${niche} ajudando profissionais e empresas a alcançarem seu potencial máximo.",
    "tagline": "Método exclusivo com resultados garantidos"
  },
  "about": {
    "bio": "Com mais de 15 anos de experiência em ${niche}, desenvolvi uma metodologia única que já transformou centenas de profissionais e empresas...",
    "experience_years": 15,
    "clients_count": 500,
    "specializations": ${JSON.stringify(services.slice(0, 5))}
  },
  "methodology": {
    "name": "Método ${company.split(' ')[0]}",
    "unique_selling_point": "Abordagem prática e personalizada com resultados mensuráveis em 90 dias.",
    "steps": [
      { "title": "Diagnóstico", "description": "Análise profunda da situação atual" },
      { "title": "Estratégia", "description": "Plano de ação personalizado" },
      { "title": "Execução", "description": "Acompanhamento hands-on" },
      { "title": "Resultados", "description": "Métricas e ajustes contínuos" }
    ]
  },
  "testimonials": [
    { "quote": "Transformou completamente minha abordagem profissional.", "name": "João P.", "context": "Empresário" },
    { "quote": "Resultados que superam expectativas.", "name": "Maria S.", "context": "Gerente de Projetos" }
  ],
  "media": [
    { "type": "podcast", "title": "Entrevista sobre ${niche}", "source": "Podcast Negócios" },
    { "type": "article", "title": "Tendências em ${niche}", "source": "Revista Exame" }
  ],
  "cta": {
    "headline": "Pronto para Transformar Sua Carreira?",
    "description": "Agende uma sessão estratégica gratuita de 30 minutos.",
    "action_text": "Agendar Consulta"
  },
  "social": {
    "linkedin": "https://linkedin.com/in/exemplo",
    "instagram": "https://instagram.com/exemplo"
  },
  "authority_content": "<h2>Minha Jornada em ${niche}</h2><p>Conteúdo editorial para SEO pessoal...</p>"
}`
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { 
      company_name, 
      niche, 
      city, 
      services = [],
      template_type = 'service_authority_v1'
    } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Validate template type
    const validTemplates: LandingPageTemplate[] = ['service_authority_v1', 'institutional_v1', 'specialist_authority_v1'];
    const selectedTemplate: LandingPageTemplate = validTemplates.includes(template_type) 
      ? template_type 
      : 'service_authority_v1';

    console.log(`[generate-landing-page] Generating ${selectedTemplate} for ${company_name} in ${city}`);

    const companyName = company_name || 'Empresa';
    const nicheValue = niche || 'Serviços';
    const cityValue = city || 'São Paulo';
    const servicesArray = services.length > 0 ? services : ['Serviço 1', 'Serviço 2', 'Serviço 3'];

    // Get template-specific prompt
    const systemPrompt = TEMPLATE_PROMPTS[selectedTemplate](
      companyName,
      nicheValue,
      cityValue,
      servicesArray
    );

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${LOVABLE_API_KEY}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt }, 
          { role: 'user', content: `Gerar Super Página ${selectedTemplate} para ${companyName} em ${cityValue}. Serviços: ${servicesArray.join(', ')}` }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!aiRes.ok) {
      const errorText = await aiRes.text();
      console.error('[generate-landing-page] AI error:', errorText);
      
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Rate limit exceeded. Please try again later.' 
        }), {
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      throw new Error(`AI request failed: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in AI response');
    }

    const pageData = robustJsonParse(content);
    
    // Ensure template field is set correctly
    pageData.template = selectedTemplate;

    // Generate SEO fields automatically
    const seoTitle = buildSeoTitle(pageData, companyName, nicheValue, cityValue);
    const seoDescription = buildSeoDescription(pageData, nicheValue, cityValue, companyName);
    const seoKeywords = extractKeywords(pageData, nicheValue, servicesArray, cityValue, companyName);
    const slug = buildSlug(pageData.hero?.headline || pageData.hero?.title, nicheValue, cityValue);

    console.log(`[generate-landing-page] Successfully generated ${selectedTemplate} page with SEO fields`);
    console.log(`[generate-landing-page] SEO Title: ${seoTitle} (${seoTitle.length} chars)`);
    console.log(`[generate-landing-page] SEO Description: ${seoDescription.length} chars`);
    console.log(`[generate-landing-page] Keywords: ${seoKeywords.join(', ')}`);

    return new Response(JSON.stringify({ 
      success: true, 
      page_data: pageData,
      seo_title: seoTitle,
      seo_description: seoDescription,
      seo_keywords: seoKeywords,
      slug: slug
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[generate-landing-page] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
