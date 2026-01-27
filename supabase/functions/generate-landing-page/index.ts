import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type LandingPageTemplate = 'service_authority_v1' | 'institutional_v1' | 'specialist_authority_v1';

// Template-specific prompts
const TEMPLATE_PROMPTS: Record<LandingPageTemplate, (company: string, niche: string, city: string, services: string[]) => string> = {
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

SCHEMA OBRIGATÓRIO:
{
  "template": "specialist_authority_v1",
  "specialist": { 
    "name": "${company}",
    "title": "Especialista em ${niche}",
    "credentials": "MBA, 15+ anos de experiência",
    "photo_prompt": "Professional portrait photography of expert consultant, confident pose, studio lighting, 8k"
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

    // Get template-specific prompt
    const systemPrompt = TEMPLATE_PROMPTS[selectedTemplate](
      company_name || 'Empresa',
      niche || 'Serviços',
      city || 'São Paulo',
      services.length > 0 ? services : ['Serviço 1', 'Serviço 2', 'Serviço 3']
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
          { role: 'user', content: `Gerar Super Página ${selectedTemplate} para ${company_name} em ${city}. Serviços: ${services.join(', ')}` }
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

    const pageData = JSON.parse(content);
    
    // Ensure template field is set correctly
    pageData.template = selectedTemplate;

    console.log(`[generate-landing-page] Successfully generated ${selectedTemplate} page`);

    return new Response(JSON.stringify({ success: true, page_data: pageData }), {
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
