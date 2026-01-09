import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FunnelRequest {
  blogId: string;
  personaId: string | null;
  topOfFunnel: number;
  middleOfFunnel: number;
  bottomOfFunnel: number;
  useGenericPersona?: boolean;
}

// Generic persona fallback
const GENERIC_PERSONA = {
  name: "Público Geral",
  problems: [
    "Falta de tempo para tarefas do dia a dia",
    "Dificuldade em encontrar soluções confiáveis",
    "Custos elevados sem retorno garantido",
    "Falta de conhecimento técnico",
    "Processos manuais e ineficientes"
  ],
  solutions: [
    "Automatização de processos repetitivos",
    "Ferramentas digitais acessíveis",
    "Metodologias comprovadas de produtividade",
    "Capacitação e treinamento prático",
    "Suporte especializado e personalizado"
  ],
  objections: [
    "E se não funcionar para o meu caso?",
    "Quanto tempo leva para ver resultados?",
    "O investimento vale a pena?",
    "Preciso de conhecimento técnico?",
    "Como garantir que é seguro e confiável?"
  ]
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { blogId, personaId, topOfFunnel, middleOfFunnel, bottomOfFunnel, useGenericPersona }: FunnelRequest = await req.json();

    console.log(`Generating funnel articles for blog ${blogId}, persona ${personaId || 'generic'}`);
    console.log(`Counts: top=${topOfFunnel}, middle=${middleOfFunnel}, bottom=${bottomOfFunnel}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch persona data or use generic
    let persona = GENERIC_PERSONA;
    
    if (personaId && !useGenericPersona) {
      const { data: personaData, error: personaError } = await supabase
        .from('personas')
        .select('name, problems, solutions, objections')
        .eq('id', personaId)
        .single();

      if (!personaError && personaData) {
        persona = personaData;
        console.log(`Using persona: ${persona.name}`);
      } else {
        console.log('Persona not found, using generic persona');
      }
    } else {
      console.log('Using generic persona (fallback)');
    }

    console.log(`Problems: ${persona.problems?.length || 0}, Solutions: ${persona.solutions?.length || 0}, Objections: ${persona.objections?.length || 0}`);
    console.log(`Problems: ${persona.problems?.length || 0}, Solutions: ${persona.solutions?.length || 0}, Objections: ${persona.objections?.length || 0}`);

    // Fetch editorial template if exists
    const { data: template } = await supabase
      .from('editorial_templates')
      .select('rules')
      .eq('blog_id', blogId)
      .eq('is_active', true)
      .limit(1)
      .single();

    const templateRules = template?.rules || '';

    // Generate themes using AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const themes: { theme: string; stage: string }[] = [];

    // Generate TOP of funnel themes (problems)
    if (topOfFunnel > 0 && persona.problems && persona.problems.length > 0) {
      const topThemes = await generateThemes(
        LOVABLE_API_KEY,
        persona.name,
        persona.problems,
        'topo',
        topOfFunnel,
        templateRules
      );
      themes.push(...topThemes.map(t => ({ theme: t, stage: 'top' })));
    }

    // Generate MIDDLE of funnel themes (solutions)
    if (middleOfFunnel > 0 && persona.solutions && persona.solutions.length > 0) {
      const middleThemes = await generateThemes(
        LOVABLE_API_KEY,
        persona.name,
        persona.solutions,
        'meio',
        middleOfFunnel,
        templateRules
      );
      themes.push(...middleThemes.map(t => ({ theme: t, stage: 'middle' })));
    }

    // Generate BOTTOM of funnel themes (objections)
    if (bottomOfFunnel > 0 && persona.objections && persona.objections.length > 0) {
      const bottomThemes = await generateThemes(
        LOVABLE_API_KEY,
        persona.name,
        persona.objections,
        'fundo',
        bottomOfFunnel,
        templateRules
      );
      themes.push(...bottomThemes.map(t => ({ theme: t, stage: 'bottom' })));
    }

    console.log(`Generated ${themes.length} themes total`);

    // Insert into article_queue
    const queueItems = themes.map((item, index) => ({
      blog_id: blogId,
      suggested_theme: item.theme,
      status: 'pending',
      scheduled_for: new Date(Date.now() + index * 60000).toISOString(), // Stagger by 1 minute each
      generation_source: 'sales_funnel',
      persona_id: personaId,
      funnel_stage: item.stage,
    }));

    const { error: insertError } = await supabase
      .from('article_queue')
      .insert(queueItems);

    if (insertError) {
      console.error('Error inserting queue items:', insertError);
      throw insertError;
    }

    console.log(`Successfully queued ${queueItems.length} articles`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: queueItems.length,
        themes: themes.map(t => t.theme)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in generate-funnel-articles:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateThemes(
  apiKey: string,
  personaName: string,
  items: string[],
  stage: string,
  count: number,
  templateRules: string
): Promise<string[]> {
  const stageDescriptions: Record<string, string> = {
    'topo': 'Artigos educativos que ajudam o leitor a entender seus problemas e desafios. Foco em conscientização.',
    'meio': 'Artigos comparativos que exploram diferentes soluções e ajudam na consideração. Foco em avaliação.',
    'fundo': 'Artigos que quebram objeções e facilitam a decisão de compra. Foco em conversão.',
  };

  const prompt = `Você é um especialista em marketing de conteúdo. Gere exatamente ${count} títulos de artigos para a etapa de ${stage} de funil de vendas.

Persona: ${personaName}
Descrição da etapa: ${stageDescriptions[stage]}
${templateRules ? `\nRegras editoriais: ${templateRules}` : ''}

Dados para basear os títulos:
${items.slice(0, 10).map((item, i) => `${i + 1}. ${item}`).join('\n')}

Retorne APENAS os títulos, um por linha, sem numeração ou explicações.`;

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'user', content: prompt }
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI API error:', response.status, errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  
  // Parse themes from response
  const themes = content
    .split('\n')
    .map((line: string) => line.trim())
    .filter((line: string) => line.length > 10)
    .slice(0, count);

  console.log(`Generated ${themes.length} themes for ${stage}:`, themes);
  
  return themes;
}
