import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// POLISH ARTICLE FINAL - CONTRATO EDITORIAL ABSOLUTO
// ============================================================================
// Polidor final que normaliza a estrutura sem alterar conteúdo.
// Deve ser chamado ANTES de qualquer salvamento ou publicação.
// ============================================================================

const POLISHING_PROMPT = `Você é um editor profissional implacável. Sua função não é reescrever o conteúdo, mas corrigir e normalizar a estrutura do artigo para que ele obedeça 100% às regras editoriais abaixo.

⚠️ Você deve preservar o conteúdo, o tom e a qualidade do texto.
Apenas ajuste formato, estrutura e quebras quando necessário.

REGRAS INVIOLÁVEIS:

1. O artigo DEVE começar exatamente assim:
# Título do Artigo

Primeiro parágrafo aqui...

   • Apenas 1 H1
   • Linha em branco obrigatória após o H1
   • A terceira linha deve ser texto, nunca um heading

2. O artigo DEVE terminar com uma seção H2 com o título EXATO:
## Próximo passo

   • Não use variações
   • Não use "Conclusão", "Considerações finais", "Direto ao ponto" ou similares
   • Esta deve ser a última H2 do artigo

3. A seção ## Próximo passo deve conter:
   • 1 parágrafo conectando a dor do artigo com a solução
   • 1 parágrafo com instrução clara do que fazer
   • O último parágrafo deve conter um CTA em negrito, acionável

4. Parágrafos devem ter no máximo 3-4 linhas
   • Se um parágrafo estiver longo, divida em dois
   • Nunca empobreça o texto, apenas quebre

5. Não altere:
   • A argumentação
   • O tom
   • A voz do autor
   • A profundidade do conteúdo

6. Sua saída deve ser o artigo final pronto para publicação, já corrigido.

Se qualquer regra for violada no texto original, corrija automaticamente.
Nunca explique.
Nunca comente.
Apenas entregue o artigo perfeito.`;

interface PolishResult {
  success: boolean;
  content: string;
  changes: string[];
  structureValid: boolean;
  originalWordCount: number;
  finalWordCount: number;
}

/**
 * Valida a estrutura do artigo conforme Contrato Editorial Absoluto
 */
function validateStructure(content: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const lines = content.split('\n');
  
  // Regra 1: H1 → linha vazia → parágrafo
  const firstNonEmpty = lines.findIndex(l => l.trim() !== '');
  if (firstNonEmpty >= 0) {
    const line1 = lines[firstNonEmpty];
    if (!line1.startsWith('# ') || line1.startsWith('## ')) {
      issues.push('H1_MISSING: Artigo não começa com H1');
    } else {
      // Verificar linha em branco após H1
      if (firstNonEmpty + 1 < lines.length && lines[firstNonEmpty + 1].trim() !== '') {
        issues.push('H1_NO_BLANK: Falta linha em branco após H1');
      }
      // Verificar parágrafo na linha 3
      if (firstNonEmpty + 2 < lines.length) {
        const line3 = lines[firstNonEmpty + 2].trim();
        if (line3 === '' || line3.startsWith('#')) {
          issues.push('H1_NO_PARAGRAPH: Terceira linha deve ser parágrafo, não heading');
        }
      }
    }
  }
  
  // Regra 2: Última H2 = "## Próximo passo"
  const h2Matches = content.match(/^## .+$/gm) || [];
  if (h2Matches.length > 0) {
    const lastH2 = h2Matches[h2Matches.length - 1].trim();
    if (lastH2 !== '## Próximo passo') {
      issues.push(`CTA_WRONG: Última H2 é "${lastH2}", deveria ser "## Próximo passo"`);
    }
  } else {
    issues.push('NO_H2: Artigo sem seções H2');
  }
  
  // Regra 3: CTA em negrito na última seção
  const lastH2Index = content.lastIndexOf('## Próximo passo');
  if (lastH2Index !== -1) {
    const lastSection = content.slice(lastH2Index);
    if (!lastSection.includes('**')) {
      issues.push('CTA_NO_BOLD: Seção "Próximo passo" sem CTA em negrito');
    }
  }
  
  // Regra 4: Parágrafos longos (check básico)
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 100);
  const longParagraphs = paragraphs.filter(p => {
    const lineCount = p.split('\n').filter(l => l.trim().length > 0).length;
    return lineCount > 5;
  });
  if (longParagraphs.length > 2) {
    issues.push('LONG_PARAGRAPHS: Muitos parágrafos com mais de 4 linhas');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content } = await req.json();

    if (!content || typeof content !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Content is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const originalWordCount = content.split(/\s+/).filter(Boolean).length;
    
    // Pre-validation: Check if article already complies
    const preValidation = validateStructure(content);
    
    if (preValidation.valid) {
      console.log('[POLISH] Article already compliant - no changes needed');
      return new Response(
        JSON.stringify({
          success: true,
          content,
          changes: [],
          structureValid: true,
          originalWordCount,
          finalWordCount: originalWordCount
        } as PolishResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[POLISH] Pre-validation issues: ${preValidation.issues.join(', ')}`);

    // Call Lovable AI Gateway for polishing
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: POLISHING_PROMPT
          },
          {
            role: "user",
            content: `[COLE AQUI O ARTIGO GERADO PELA IA]\n\n${content}`
          }
        ],
        temperature: 0.2, // Low temperature for precision
        max_tokens: 16000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[POLISH] AI Gateway error: ${response.status} - ${errorText}`);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    let polishedContent = aiResult.choices?.[0]?.message?.content || '';

    if (!polishedContent.trim()) {
      console.warn('[POLISH] AI returned empty content - using original');
      return new Response(
        JSON.stringify({
          success: false,
          content,
          changes: ['AI returned empty - using original'],
          structureValid: false,
          originalWordCount,
          finalWordCount: originalWordCount
        } as PolishResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Post-validation: Check if polishing fixed the issues
    const postValidation = validateStructure(polishedContent);
    const finalWordCount = polishedContent.split(/\s+/).filter(Boolean).length;
    
    // Track changes made
    const changes: string[] = [];
    if (preValidation.issues.some(i => i.includes('H1')) && !postValidation.issues.some(i => i.includes('H1'))) {
      changes.push('H1 normalizado');
    }
    if (preValidation.issues.some(i => i.includes('CTA_WRONG')) && !postValidation.issues.some(i => i.includes('CTA_WRONG'))) {
      changes.push('Última seção renomeada para "## Próximo passo"');
    }
    if (preValidation.issues.some(i => i.includes('CTA_NO_BOLD')) && !postValidation.issues.some(i => i.includes('CTA_NO_BOLD'))) {
      changes.push('CTA em negrito adicionado');
    }
    if (preValidation.issues.some(i => i.includes('LONG_PARAGRAPHS')) && !postValidation.issues.some(i => i.includes('LONG_PARAGRAPHS'))) {
      changes.push('Parágrafos longos divididos');
    }

    // Word count protection: Don't allow more than 15% reduction
    const wordCountDiff = (originalWordCount - finalWordCount) / originalWordCount;
    if (wordCountDiff > 0.15) {
      console.warn(`[POLISH] Word count reduced by ${Math.round(wordCountDiff * 100)}% - using original to preserve content`);
      return new Response(
        JSON.stringify({
          success: false,
          content,
          changes: ['Word count reduced too much - preserving original'],
          structureValid: false,
          originalWordCount,
          finalWordCount: originalWordCount
        } as PolishResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[POLISH] Complete - Changes: ${changes.length}, Valid: ${postValidation.valid}, Words: ${originalWordCount} → ${finalWordCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        content: polishedContent,
        changes,
        structureValid: postValidation.valid,
        originalWordCount,
        finalWordCount
      } as PolishResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[POLISH] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
