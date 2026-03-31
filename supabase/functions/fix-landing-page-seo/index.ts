import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { generateText, generateImage } from '../_shared/omniseen-ai.ts';


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FixRequest {
  landing_page_id: string;
  fix_types?: ("title" | "meta" | "content" | "keywords" | "images" | "structure")[];
}

// Extract text content from all blocks
function extractPageContent(pageData: any): string {
  const parts: string[] = [];
  
  // Hero
  if (pageData.hero) {
    parts.push(pageData.hero.headline || pageData.hero.title || '');
    parts.push(pageData.hero.subheadline || pageData.hero.subtitle || '');
  }
  
  // Authority content
  if (pageData.authority_content) {
    const text = typeof pageData.authority_content === 'string' 
      ? pageData.authority_content 
      : pageData.authority_content.html || '';
    parts.push(text.replace(/<[^>]*>/g, ' ')); // Strip HTML
  }
  
  // Services
  if (Array.isArray(pageData.services)) {
    pageData.services.forEach((s: any) => {
      parts.push(s.title || '');
      parts.push(s.desc || s.description || '');
    });
  }
  
  // Service details
  if (Array.isArray(pageData.service_details)) {
    pageData.service_details.forEach((s: any) => {
      parts.push(s.title || '');
      parts.push(s.content || '');
      if (Array.isArray(s.bullets)) parts.push(s.bullets.join(' '));
    });
  }
  
  // FAQ
  if (Array.isArray(pageData.faq)) {
    pageData.faq.forEach((f: any) => {
      parts.push(f.question || '');
      parts.push(f.answer || '');
    });
  }
  
  // Specialist template specific
  if (pageData.specialist) {
    parts.push(pageData.specialist.name || '');
    parts.push(pageData.specialist.title || '');
    parts.push(pageData.specialist.credentials || '');
  }
  
  if (pageData.about?.bio) {
    parts.push(pageData.about.bio);
  }
  
  if (pageData.methodology?.name) {
    parts.push(pageData.methodology.name);
    parts.push(pageData.methodology.unique_selling_point || '');
    if (Array.isArray(pageData.methodology.steps)) {
      pageData.methodology.steps.forEach((s: any) => {
        parts.push(s.title || '');
        parts.push(s.description || '');
      });
    }
  }
  
  return parts.filter(Boolean).join(' ');
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countImages(pageData: any): number {
  let count = 0;
  
  if (pageData.hero?.background_image_url || pageData.hero?.image_url) count++;
  if (pageData.specialist?.photo_url) count++;
  
  if (Array.isArray(pageData.services)) {
    count += pageData.services.filter((s: any) => s.image_url).length;
  }
  
  if (Array.isArray(pageData.service_details)) {
    count += pageData.service_details.filter((s: any) => s.image_url).length;
  }
  
  return count;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { landing_page_id, fix_types = ["title", "meta", "content", "keywords"] }: FixRequest = await req.json();

    if (!landing_page_id) {
      return new Response(
        JSON.stringify({ success: false, error: "landing_page_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[FIX-LP-SEO] Starting comprehensive SEO fix for page: ${landing_page_id}`);
    console.log(`[FIX-LP-SEO] Fix types: ${fix_types.join(', ')}`);

    // Fetch landing page
    const { data: page, error: pageError } = await supabase
      .from("landing_pages")
      .select("*")
      .eq("id", landing_page_id)
      .single();

    if (pageError || !page) {
      return new Response(
        JSON.stringify({ success: false, error: "Landing page not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch business profile for context
    const { data: profile } = await supabase
      .from("business_profile")
      .select("*")
      .eq("blog_id", page.blog_id)
      .single();

    const pageData = page.page_data || {};
    const currentTitle = page.seo_title || page.title || "";
    const currentMeta = page.seo_description || "";
    const currentKeywords = page.seo_keywords || [];

    // Build context for AI
    const context = {
      company: profile?.company_name || "Empresa",
      niche: profile?.niche || "",
      city: profile?.city || "",
      services: profile?.services || "",
      heroTitle: pageData?.hero?.title || pageData?.hero?.headline || "",
      heroSubtitle: pageData?.hero?.subtitle || pageData?.hero?.subheadline || "",
    };

    // Extract current content metrics
    const currentContent = extractPageContent(pageData);
    const currentWordCount = countWords(currentContent);
    const currentImageCount = countImages(pageData);
    const targetWordCount = 1500;

    console.log(`[FIX-LP-SEO] Current metrics - Words: ${currentWordCount}, Images: ${currentImageCount}`);

    const updates: Record<string, any> = {};
    const fixes: string[] = [];
    let updatedPageData = JSON.parse(JSON.stringify(pageData)); // Deep clone

    // Use Lovable AI for comprehensive improvements
    if (googleAiKey) {
      const needsContentExpansion = fix_types.includes("content") && currentWordCount < targetWordCount;
      const needsKeywordInjection = fix_types.includes("keywords");
      const needsStructure = fix_types.includes("structure");

      // Build comprehensive AI prompt
      const aiPrompt = `Você é um editor SEO de PRECISÃO CIRÚRGICA para landing pages de serviços locais.

## CONTEXTO DA PÁGINA
- Empresa: ${context.company}
- Nicho: ${context.niche}
- Cidade: ${context.city}
- Serviços: ${context.services}
- Título atual: ${currentTitle}
- Meta atual: ${currentMeta}
- Keywords atuais: ${currentKeywords.join(', ')}
- Palavras atuais: ${currentWordCount}
- Meta de palavras: ${targetWordCount}

## CONTEÚDO ATUAL (authority_content)
${pageData.authority_content || 'Sem conteúdo de autoridade'}

## FAQ ATUAL
${JSON.stringify(pageData.faq || [])}

## TAREFAS OBRIGATÓRIAS
${fix_types.includes("title") ? `1. TÍTULO SEO: Crie um título de 50-60 caracteres com keyword principal + cidade.` : ''}
${fix_types.includes("meta") ? `2. META DESCRIPTION: Crie uma descrição de 140-160 caracteres com CTA e keywords.` : ''}
${fix_types.includes("keywords") ? `3. KEYWORDS: Liste 5-7 palavras-chave relevantes para o nicho e cidade.` : ''}
${needsContentExpansion ? `4. AUTHORITY_CONTENT: Expanda o conteúdo para atingir ${targetWordCount} palavras. 
   - Adicione seções H2 sobre os serviços
   - Inclua benefícios, diferenciais e expertise
   - Mantenha tom profissional e persuasivo
   - Use HTML válido (h2, p, ul, li)` : ''}
${fix_types.includes("structure") ? `5. FAQ: Adicione 3-5 perguntas frequentes relevantes se houver menos de 3.` : ''}

## REGRAS ABSOLUTAS
- NÃO altere o que já está bom
- NÃO use emojis
- MANTENHA formatação HTML limpa
- INJETE keywords naturalmente (densidade 0.5%-2.5%)

## RESPOSTA (JSON VÁLIDO)
{
  ${fix_types.includes("title") ? '"seo_title": "título otimizado",' : ''}
  ${fix_types.includes("meta") ? '"seo_description": "meta description otimizada",' : ''}
  ${fix_types.includes("keywords") ? '"seo_keywords": ["kw1", "kw2", "kw3", "kw4", "kw5"],' : ''}
  ${needsContentExpansion ? '"authority_content": "<h2>...</h2><p>...</p>",' : ''}
  ${fix_types.includes("structure") ? '"faq": [{"question": "...", "answer": "..."}],' : ''}
  "improvements_made": ["lista de melhorias aplicadas"]
}`;

      try {
        console.log(`[FIX-LP-SEO] Calling AI for optimization...`);
        
        const aiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${googleAiKey}`,
          },
          body: JSON.stringify({
            model: 'gemini-2.5-flash',
            messages: [{ role: "user", content: aiPrompt }],
            response_format: { type: "json_object" },
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          
          if (content) {
            const parsed = JSON.parse(content);
            
            // Apply SEO title fix
            if (parsed.seo_title && fix_types.includes("title")) {
              updates.seo_title = parsed.seo_title;
              fixes.push("title");
              console.log(`[FIX-LP-SEO] New title: ${parsed.seo_title}`);
            }
            
            // Apply meta description fix
            if (parsed.seo_description && fix_types.includes("meta")) {
              updates.seo_description = parsed.seo_description;
              fixes.push("meta");
              console.log(`[FIX-LP-SEO] New meta: ${parsed.seo_description.slice(0, 50)}...`);
            }
            
            // Apply keywords fix
            if (parsed.seo_keywords && fix_types.includes("keywords")) {
              updates.seo_keywords = parsed.seo_keywords;
              fixes.push("keywords");
              console.log(`[FIX-LP-SEO] New keywords: ${parsed.seo_keywords.join(', ')}`);
            }
            
            // Apply content expansion
            if (parsed.authority_content && needsContentExpansion) {
              updatedPageData.authority_content = parsed.authority_content;
              fixes.push("content_expanded");
              const newWordCount = countWords(parsed.authority_content.replace(/<[^>]*>/g, ' '));
              console.log(`[FIX-LP-SEO] Content expanded to ~${newWordCount} words`);
            }
            
            // Apply FAQ improvements
            if (parsed.faq && fix_types.includes("structure")) {
              // Merge with existing FAQ
              const existingFaq = pageData.faq || [];
              const newFaq = parsed.faq || [];
              
              // Add new FAQs that don't duplicate existing
              const existingQuestions = existingFaq.map((f: any) => f.question?.toLowerCase());
              const uniqueNewFaq = newFaq.filter((f: any) => 
                !existingQuestions.includes(f.question?.toLowerCase())
              );
              
              if (uniqueNewFaq.length > 0) {
                updatedPageData.faq = [...existingFaq, ...uniqueNewFaq];
                fixes.push("faq_added");
                console.log(`[FIX-LP-SEO] Added ${uniqueNewFaq.length} new FAQs`);
              }
            }
            
            if (parsed.improvements_made) {
              console.log(`[FIX-LP-SEO] Improvements: ${parsed.improvements_made.join(', ')}`);
            }
          }
        } else {
          console.error("[FIX-LP-SEO] AI request failed:", await aiResponse.text());
        }
      } catch (aiError) {
        console.error("[FIX-LP-SEO] AI call failed:", aiError);
      }
    }

    // Fallback: Simple improvements if AI failed or no API key
    if (fixes.length === 0) {
      console.log("[FIX-LP-SEO] Using fallback improvements...");
      
      if (fix_types.includes("title") && currentTitle.length < 50) {
        const improvedTitle = `${context.company} - ${context.niche} em ${context.city}`.slice(0, 60);
        updates.seo_title = improvedTitle;
        fixes.push("title");
      }
      
      if (fix_types.includes("meta") && currentMeta.length < 100) {
        const improvedMeta = `${context.company} oferece ${context.services} em ${context.city}. Atendimento especializado e qualidade garantida. Solicite orçamento!`.slice(0, 160);
        updates.seo_description = improvedMeta;
        fixes.push("meta");
      }
      
      if (fix_types.includes("keywords") && currentKeywords.length < 3) {
        const keywords = [
          context.niche,
          `${context.niche} ${context.city}`,
          context.services?.split(",")[0]?.trim(),
          context.company,
          `${context.services?.split(",")[0]?.trim()} ${context.city}`,
        ].filter(Boolean);
        updates.seo_keywords = keywords;
        fixes.push("keywords");
      }
    }

    // Check if page_data was updated
    const pageDataChanged = JSON.stringify(updatedPageData) !== JSON.stringify(pageData);
    if (pageDataChanged) {
      updates.page_data = updatedPageData;
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from("landing_pages")
        .update(updates)
        .eq("id", landing_page_id);

      if (updateError) {
        console.error("[FIX-LP-SEO] Update failed:", updateError);
        return new Response(
          JSON.stringify({ success: false, error: "Failed to apply fixes" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`[FIX-LP-SEO] Applied fixes: ${fixes.join(", ")}`);

    // Trigger re-analysis
    try {
      await supabase.functions.invoke("analyze-landing-page-seo", {
        body: { landing_page_id },
      });
      console.log("[FIX-LP-SEO] Re-analysis triggered");
    } catch (e) {
      console.warn("[FIX-LP-SEO] Re-analysis trigger failed:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        fixes_applied: fixes,
        updates: {
          seo_title: updates.seo_title,
          seo_description: updates.seo_description,
          seo_keywords: updates.seo_keywords,
          content_expanded: pageDataChanged,
        },
        metrics: {
          word_count_before: currentWordCount,
          image_count: currentImageCount,
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[FIX-LP-SEO] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
