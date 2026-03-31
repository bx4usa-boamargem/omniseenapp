/**
 * FIX-BROKEN-LINK: Corrige links quebrados em artigos.
 * Métodos: remove (mantém texto âncora) ou rewrite (reescrita via IA).
 * Migrado para usar omniseen-ai.ts centralizado.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from '../_shared/omniseen-ai.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

serve(async (req: Request) => {
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

    console.log(`[FIX_BROKEN_LINK] Fixing ${brokenLink.url} in article ${article.id} method=${fix_method}`);

    if (fix_method === 'remove') {
      const htmlLinkRegex = new RegExp(`<a[^>]+href=["']${escapedUrl}["'][^>]*>([^<]*)</a>`, 'gi');
      newContent = newContent.replace(htmlLinkRegex, '$1');
      const mdLinkRegex = new RegExp(`\\[([^\\]]+)\\]\\(${escapedUrl}\\)`, 'g');
      newContent = newContent.replace(mdLinkRegex, '$1');
      console.log('[FIX_BROKEN_LINK] Removed link, kept anchor text');

    } else if (fix_method === 'rewrite') {
      const urlIndex = article.content.indexOf(brokenLink.url);
      if (urlIndex !== -1) {
        const contextStart = Math.max(0, urlIndex - 200);
        const contextEnd = Math.min(article.content.length, urlIndex + brokenLink.url.length + 200);
        const surroundingContext = article.content.substring(contextStart, contextEnd);

        const aiResult = await generateText('broken_link_fix', [
          {
            role: 'system',
            content: 'Você é um editor de conteúdo. Reescreva o trecho de texto removendo ou substituindo o link quebrado, mantendo o sentido original. Retorne APENAS o trecho reescrito, sem explicações.'
          },
          {
            role: 'user',
            content: `O link "${brokenLink.url}" está quebrado no seguinte trecho:\n\n"${surroundingContext}"\n\nTexto âncora do link: "${brokenLink.anchor_text || 'link'}"\n\nReescreva este trecho removendo o link quebrado, mantendo o sentido e a fluidez.`
          }
        ]);

        if (aiResult.success && aiResult.content && aiResult.content.length > 10) {
          newContent = article.content.substring(0, contextStart) +
                       aiResult.content.trim() +
                       article.content.substring(contextEnd);
          console.log('[FIX_BROKEN_LINK] Rewrote section with AI');
        } else {
          // Fallback: remove method
          const htmlLinkRegex = new RegExp(`<a[^>]+href=["']${escapedUrl}["'][^>]*>([^<]*)</a>`, 'gi');
          newContent = newContent.replace(htmlLinkRegex, '$1');
          console.log('[FIX_BROKEN_LINK] AI rewrite failed, fell back to remove');
        }
      } else {
        console.log('[FIX_BROKEN_LINK] Link not found in content, marking as fixed');
      }
    }

    const { error: updateError } = await supabase
      .from('articles')
      .update({ content: newContent, updated_at: new Date().toISOString() })
      .eq('id', article.id);

    if (updateError) throw updateError;

    await supabase
      .from('article_broken_links')
      .update({ is_fixed: true, fixed_at: new Date().toISOString(), fix_method })
      .eq('id', broken_link_id);

    console.log(`[FIX_BROKEN_LINK] Successfully fixed link in article ${article.id}`);

    return new Response(
      JSON.stringify({ success: true, article_id: article.id, fix_method, url_fixed: brokenLink.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[FIX_BROKEN_LINK] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
