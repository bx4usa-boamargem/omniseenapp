import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { company_name, niche, city, services = [] } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    // PROMPT FORÇANDO O NOVO SCHEMA service_authority_v1
    const systemPrompt = `Você é um Especialista em Landing Pages de Alta Conversão. 
Gere um JSON para o template "service_authority_v1".
REGRAS:
- Use nomes reais de cidades e serviços.
- Crie um conteúdo longo (1200+ palavras) para authority_content.
- NÃO use emojis ou placeholders.
- Crie PROMPTS DE IMAGEM FOTOREALISTAS para Hero e cada Serviço.

SCHEMA OBRIGATÓRIO:
{
  "template": "service_authority_v1",
  "brand": { "company_name": "${company_name}", "phone": "555-0199", "city": "${city}", "service": "${niche}" },
  "hero": { 
    "headline": "Professional ${niche} in ${city}", 
    "subheadline": "Top-rated experts serving your area with 24/7 support.",
    "image_prompt": "Photorealistic professional photography of a ${niche} specialist working in ${city}, natural lighting, high detail, 8k"
  },
  "services": [
    { 
      "title": "${services[0] || 'Expert Repair'}", 
      "desc": "High-quality professional service guaranteed.", 
      "cta": "Schedule Now", 
      "image_prompt": "Photorealistic close-up of ${niche} tools and professional hands working, industrial background"
    }
  ],
  "emergency": { "headline": "Emergency ${niche} Needed?", "subtext": "We are available 24 hours a day, 7 days a week." },
  "authority_content": "<h2>Expert ${niche} Solutions</h2><p>Long editorial content for SEO...</p>",
  "faq": [{ "question": "How fast can you arrive?", "answer": "We offer rapid response within 2 hours." }]
}`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Gerar Super Página para ${company_name} em ${city}` }],
        response_format: { type: 'json_object' }
      })
    });

    const aiData = await aiRes.json();
    const pageData = JSON.parse(aiData.choices[0].message.content);

    return new Response(JSON.stringify({ success: true, page_data: pageData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
