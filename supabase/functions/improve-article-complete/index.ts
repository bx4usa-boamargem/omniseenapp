import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImproveRequest {
  content: string;
  title: string;
  metaDescription: string;
  keywords: string[];
  businessProfile?: {
    company_name?: string;
    niche?: string;
    tone_of_voice?: string;
    country?: string;
    whatsapp?: string;
  };
  editorialTemplate?: {
    cta_template?: string;
    tone_rules?: string;
  };
}

interface Improvement {
  type: 'paragraph' | 'visual_block' | 'seo' | 'cta';
  description: string;
  location?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const request: ImproveRequest = await req.json();
    const { content, title, metaDescription, keywords, businessProfile, editorialTemplate } = request;

    if (!content) {
      return new Response(
        JSON.stringify({ error: 'Content is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const improvements: Improvement[] = [];
    let improvedContent = content;

    // 1. Analyze and fix long paragraphs (>3 lines = ~150 characters per line = ~450 chars)
    const paragraphs = improvedContent.split('\n\n');
    const fixedParagraphs: string[] = [];
    
    paragraphs.forEach((p, index) => {
      const lines = p.split('\n');
      const estimatedLines = Math.ceil(p.length / 120); // ~120 chars per line in typical editor
      
      if (estimatedLines > 3 && !p.startsWith('#') && !p.startsWith('-') && !p.startsWith('💡') && !p.startsWith('⚠️') && !p.startsWith('📌')) {
        // Split into smaller paragraphs at sentence boundaries
        const sentences = p.match(/[^.!?]+[.!?]+/g) || [p];
        let currentParagraph = '';
        const newParagraphs: string[] = [];
        
        sentences.forEach(sentence => {
          if ((currentParagraph + sentence).length > 300) {
            if (currentParagraph) newParagraphs.push(currentParagraph.trim());
            currentParagraph = sentence;
          } else {
            currentParagraph += sentence;
          }
        });
        if (currentParagraph) newParagraphs.push(currentParagraph.trim());
        
        if (newParagraphs.length > 1) {
          fixedParagraphs.push(...newParagraphs);
          improvements.push({
            type: 'paragraph',
            description: `Parágrafo ${index + 1} dividido em ${newParagraphs.length} parágrafos menores`,
            location: `Seção ${index + 1}`
          });
        } else {
          fixedParagraphs.push(p);
        }
      } else {
        fixedParagraphs.push(p);
      }
    });

    improvedContent = fixedParagraphs.join('\n\n');

    // 2. Check for visual blocks and add if missing
    const hasInsight = improvedContent.includes('💡');
    const hasAlert = improvedContent.includes('⚠️');
    const hasTip = improvedContent.includes('📌');
    const visualBlockCount = (hasInsight ? 1 : 0) + (hasAlert ? 1 : 0) + (hasTip ? 1 : 0);

    // If less than 2 visual blocks, we need to add some
    if (visualBlockCount < 2) {
      // Use AI to generate appropriate visual blocks
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
      if (LOVABLE_API_KEY) {
        const blocksNeeded = 3 - visualBlockCount;
        const blocksToAdd: string[] = [];
        if (!hasInsight) blocksToAdd.push('💡 (Verdade Dura/Insight importante)');
        if (!hasAlert) blocksToAdd.push('⚠️ (Alerta/Erro comum)');
        if (!hasTip) blocksToAdd.push('📌 (Dica Prática)');

        const blockPrompt = `Analise o seguinte artigo e gere ${blocksNeeded} blocos visuais para inserir.

Título: ${title}
Conteúdo (resumo): ${improvedContent.substring(0, 2000)}

Blocos necessários: ${blocksToAdd.join(', ')}

Para cada bloco, retorne EXATAMENTE neste formato JSON:
{
  "blocks": [
    {
      "emoji": "💡",
      "text": "Texto do insight aqui (máximo 2 frases)",
      "insertAfterParagraph": 2
    }
  ]
}

Regras:
- 💡 Verdade Dura: Uma verdade desconfortável mas importante sobre o tema
- ⚠️ Alerta: Um erro comum que as pessoas cometem
- 📌 Dica Prática: Uma ação concreta e imediata que o leitor pode fazer

Retorne APENAS o JSON, sem explicações.`;

        try {
          const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${LOVABLE_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: 'Você é a OMNISEEN AI, a assistente virtual inteligente da OMNISEEN, editora especialista em conteúdo para blogs. Retorne apenas JSON válido.' },
                { role: 'user', content: blockPrompt }
              ],
            }),
          });

          if (aiResponse.ok) {
            const aiData = await aiResponse.json();
            const responseText = aiData.choices?.[0]?.message?.content || '';
            
            // Parse JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                const blocksData = JSON.parse(jsonMatch[0]);
                const contentParagraphs = improvedContent.split('\n\n');
                
                if (blocksData.blocks && Array.isArray(blocksData.blocks)) {
                  // Sort blocks by insert position descending to avoid index shifting
                  const sortedBlocks = blocksData.blocks.sort((a: any, b: any) => 
                    (b.insertAfterParagraph || 0) - (a.insertAfterParagraph || 0)
                  );
                  
                  sortedBlocks.forEach((block: any) => {
                    const insertIndex = Math.min(block.insertAfterParagraph || 2, contentParagraphs.length - 1);
                    const blockText = `${block.emoji} ${block.text}`;
                    contentParagraphs.splice(insertIndex + 1, 0, blockText);
                    
                    improvements.push({
                      type: 'visual_block',
                      description: `Bloco ${block.emoji} adicionado após parágrafo ${insertIndex + 1}`,
                      location: blockText.substring(0, 50) + '...'
                    });
                  });
                  
                  improvedContent = contentParagraphs.join('\n\n');
                }
              } catch (parseError) {
                console.error('Error parsing AI blocks response:', parseError);
              }
            }
          }
        } catch (aiError) {
          console.error('Error calling AI for blocks:', aiError);
        }
      }
    }

    // 3. Check keyword density and add keywords naturally if needed
    const wordCount = improvedContent.split(/\s+/).filter(w => w.length > 0).length;
    const contentLower = improvedContent.toLowerCase();
    
    keywords.forEach(keyword => {
      const matches = contentLower.match(new RegExp(keyword.toLowerCase(), 'gi'));
      const count = matches?.length || 0;
      const density = (count / wordCount) * 100;
      
      if (density < 0.3 && count < 3) {
        improvements.push({
          type: 'seo',
          description: `Palavra-chave "${keyword}" aparece apenas ${count}x (densidade: ${density.toFixed(2)}%). Considere adicionar mais ocorrências.`,
        });
      }
    });

    // 4. Garantir CTA obrigatório do contrato editorial
    const editorialContract = await import('../_shared/editorialContract.ts');
    const { hasValidCTA, ensureCTA, ensureCompanyCTA } = editorialContract;
    
    if (!hasValidCTA(improvedContent)) {
      // Verificar se temos dados da empresa para CTA personalizado
      if (businessProfile?.company_name) {
        const companyInfo = {
          name: businessProfile.company_name,
          city: businessProfile.country,
          whatsapp: businessProfile.whatsapp
        };
        improvedContent = ensureCompanyCTA(improvedContent, companyInfo);
        
        improvements.push({
          type: 'cta',
          description: `CTA obrigatório aplicado com nome da empresa: ${businessProfile.company_name}`,
        });
        
        console.log(`[IMPROVE] CTA com empresa "${businessProfile.company_name}" aplicado`);
      } else {
        // Aplicar CTA genérico
        improvedContent = ensureCTA(improvedContent);
        
        improvements.push({
          type: 'cta',
          description: 'CTA obrigatório do contrato editorial aplicado',
        });
        
        console.log('[IMPROVE] CTA genérico do contrato editorial aplicado');
      }
    } else {
      console.log('[IMPROVE] CTA já está válido no formato do contrato');
    }

    // Count statistics
    const addedVisualBlocks = improvements.filter(i => i.type === 'visual_block').length;
    const fixedParagraphsCount = improvements.filter(i => i.type === 'paragraph').length;
    const seoIssues = improvements.filter(i => i.type === 'seo').length;

    return new Response(
      JSON.stringify({
        success: true,
        improvedContent,
        improvements,
        stats: {
          addedVisualBlocks,
          fixedParagraphs: fixedParagraphsCount,
          seoIssues,
          totalImprovements: improvements.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in improve-article-complete:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
