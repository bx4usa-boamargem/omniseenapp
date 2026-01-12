/**
 * REGRA 5: VERIFICAÇÃO DE LINKS QUEBRADOS
 * 
 * Job semanal que:
 * - Percorre todos artigos publicados
 * - Extrai links
 * - Testa status HTTP
 * - Marca artigos com links quebrados
 * - Notifica usuário
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractedLink {
  url: string;
  text: string;
  context: string;
}

/**
 * Extract all links from HTML and Markdown content
 */
function extractLinks(content: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];

  // HTML links: <a href="url">text</a>
  const htmlRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  let match;
  while ((match = htmlRegex.exec(content)) !== null) {
    const url = match[1];
    const text = match[2];
    const start = Math.max(0, match.index - 50);
    const end = Math.min(content.length, match.index + match[0].length + 50);
    const context = content.substring(start, end);
    links.push({ url, text, context });
  }

  // Markdown links: [text](url)
  const mdRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  while ((match = mdRegex.exec(content)) !== null) {
    const text = match[1];
    const url = match[2];
    const start = Math.max(0, match.index - 50);
    const end = Math.min(content.length, match.index + match[0].length + 50);
    const context = content.substring(start, end);
    links.push({ url, text, context });
  }

  // Filter to only external URLs
  return links.filter(l => l.url.startsWith('http'));
}

/**
 * Check if a URL is accessible
 */
async function checkUrl(url: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Omniseen-LinkChecker/1.0'
      }
    });

    clearTimeout(timeoutId);
    
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { 
      ok: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[Broken Links] Starting check...');

    // Fetch published articles with content
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, blog_id, title, content')
      .eq('status', 'published')
      .not('content', 'is', null);

    if (articlesError) throw articlesError;

    let totalChecked = 0;
    let totalBroken = 0;
    const affectedBlogs = new Map<string, { user_id: string; broken_count: number }>();

    for (const article of articles || []) {
      if (!article.content) continue;

      const links = extractLinks(article.content);
      
      if (links.length === 0) continue;

      console.log(`[Broken Links] Checking ${links.length} links in article: ${article.title.substring(0, 30)}...`);

      for (const link of links) {
        totalChecked++;
        const result = await checkUrl(link.url);

        if (!result.ok) {
          totalBroken++;
          
          // Upsert broken link record
          const { error: upsertError } = await supabase
            .from('article_broken_links')
            .upsert({
              article_id: article.id,
              blog_id: article.blog_id,
              url: link.url,
              anchor_text: link.text,
              status_code: result.status || null,
              error_message: result.error || `HTTP ${result.status}`,
              is_fixed: false,
              last_checked_at: new Date().toISOString(),
            }, { 
              onConflict: 'article_id,url',
              ignoreDuplicates: false 
            });

          if (upsertError) {
            console.error(`[Broken Links] Failed to save: ${link.url}`, upsertError);
          } else {
            console.log(`[Broken Links] Broken: ${link.url} (${result.status || result.error})`);
            
            // Track affected blogs
            const existing = affectedBlogs.get(article.blog_id);
            if (existing) {
              existing.broken_count++;
            } else {
              // Fetch blog user_id
              const { data: blog } = await supabase
                .from('blogs')
                .select('user_id')
                .eq('id', article.blog_id)
                .single();
              
              if (blog) {
                affectedBlogs.set(article.blog_id, { 
                  user_id: blog.user_id, 
                  broken_count: 1 
                });
              }
            }
          }
        }
      }
    }

    // Send notifications to affected users
    for (const [blogId, data] of affectedBlogs.entries()) {
      await supabase.from('automation_notifications').insert({
        user_id: data.user_id,
        blog_id: blogId,
        notification_type: 'broken_links',
        title: '🔗 Links Quebrados Detectados',
        message: `${data.broken_count} link(s) quebrado(s) encontrado(s) nos seus artigos`,
      });
    }

    console.log(`[Broken Links] Complete: ${totalChecked} checked, ${totalBroken} broken, ${affectedBlogs.size} blogs affected`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        links_checked: totalChecked,
        broken_found: totalBroken,
        blogs_affected: affectedBlogs.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Broken Links] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
