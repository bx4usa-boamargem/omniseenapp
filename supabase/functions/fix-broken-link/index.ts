/**
 * REGRA 5: CORREÇÃO AUTOMÁTICA DE LINKS QUEBRADOS
 * 
 * Corrige links quebrados automaticamente com IA:
 * - remove: Remove o link, mantendo o texto
 * - rewrite: Usa IA para reescrever o trecho
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { broken_link_id, fix_method } = await req.json();

    if (!broken_link_id || !fix_method) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: broken_link_id, fix_method' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['remove', 'rewrite'].includes(fix_method)) {
      return new Response(
        JSON.stringify({ error: 'fix_method must be "remove" or "rewrite"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch broken link details with article content
    const { data: brokenLink, error: fetchError } = await supabase
      .from('article_broken_links')
      .select('*, articles:article_id(id, content, title)')
      .eq('id', broken_link_id)
      .single();

    if (fetchError || !brokenLink) {
      return new Response(
        JSON.stringify({ error: 'Broken link not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const article = brokenLink.articles as { id: string; content: string; title: string };
    if (!article || !article.content) {
      return new Response(
        JSON.stringify({ error: 'Article content not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let newContent = article.content;
    const escapedUrl = escapeRegex(brokenLink.url);

    console.log(`[Fix Broken Link] Fixing ${brokenLink.url} in article ${article.id} using method: ${fix_method}`);

    if (fix_method === 'remove') {
      // Remove HTML links, keeping anchor text
      const htmlLinkRegex = new RegExp(`<a[^>]+href=[\\\"']${escapedUrl}[\\\"'][^>]*>([^<]*)</a>`, 'gi');
      newContent = newContent.replace(htmlLinkRegex, '$1');

      // Remove Markdown links, keeping text
      const mdLinkRegex = new RegExp(`\\[([^\\]]+)\\]\\(${escapedUrl}\\)`, 'g');
      newContent = newContent.replace(mdLinkRegex, '$1');

      console.log('[Fix Broken Link] Removed link, kept anchor text');

    } else if (fix_method === 'rewrite') {
),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find surrounding context for the broken link
      const urlIndex = article.content.indexOf(brokenLink.url);
      if (urlIndex === -1) {
        // Link not found in current content, might have been removed
        console.log('[Fix Broken Link] Link not found in content, marking as fixed');
      } else {
        const contextStart = Math.max(0, urlIndex - 200);
        const contextEnd = Math.min(article.content.length, urlIndex + brokenLink.url.length + 200);
        const surroundingContext = article.content.substring(contextStart, contextEnd);

        // Ask AI to rewrite the section without the broken link
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
          method: 'POST',
          headers: {
            // Authorization handled by omniseen-ai.ts internally,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'Você é um editor de conteúdo. Reescreva o trecho de texto removendo ou substituindo o link quebrado, mantendo o sentido original. Retorne APENAS o trecho reescrito, sem explicações.'
              },
              {
                role: 'user',
                content: `O link "${brokenLink.url}" está quebrado no seguinte trecho:\n\n"${surroundingContext}"\n\nTexto âncora do link: "${brokenLink.anchor_text || 'link'}"\n\nReescreva este trecho removendo o link quebrado, mas mantendo o sentido do texto e a fluidez da leitura.`
              }
            ],
            temperature: 0.7,
            max_tokens: 500,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const rewrittenText = data.choices?.[0]?.message?.content?.trim();

          if (rewrittenText) {
            // Replace the surrounding context with rewritten version
            newContent = article.content.substring(0, contextStart) + 
                         rewrittenText + 
                         article.content.substring(contextEnd);
            
            console.log('[Fix Broken Link] Rewrote section with AI');
          }
        } else {
          console.error('[Fix Broken Link] AI API error:', response.status);
          // Fallback to remove method
          const htmlLinkRegex = new RegExp(`<a[^>]+href=[\\\"']${escapedUrl}[\\\"'][^>]*>([^<]*)</a>`, 'gi');
          newContent = newContent.replace(htmlLinkRegex, '$1');
          const mdLinkRegex = new RegExp(`\\[([^\\]]+)\\]\\(${escapedUrl}\\)`, 'g');
          newContent = newContent.replace(mdLinkRegex, '$1');
        }
      }
    }

    // Update article content
    const { error: updateError } = await supabase
      .from('articles')
      .update({ 
        content: newContent, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', article.id);

    if (updateError) {
      throw updateError;
    }

    // Mark broken link as fixed
    await supabase
      .from('article_broken_links')
      .update({
        is_fixed: true,
        fixed_at: new Date().toISOString(),
        fix_method,
      })
      .eq('id', broken_link_id);

    console.log(`[Fix Broken Link] Successfully fixed link in article ${article.id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        article_id: article.id,
        fix_method,
        url_fixed: brokenLink.url
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Fix Broken Link] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
