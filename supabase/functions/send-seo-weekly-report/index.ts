/**
 * REGRA 5: RELATÓRIO SEO SEMANAL
 * 
 * Job semanal que gera relatório de SEO por blog com:
 * - Total de artigos
 * - Média do SEO score
 * - Artigos fracos (<60%)
 * - Comparativo com semana anterior
 * - Sugestões automáticas
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SEOScoreDetails {
  titleScore: number;
  metaScore: number;
  contentScore: number;
  keywordScore: number;
  imageScore: number;
  total: number;
}

// Simplified SEO score calculation for backend
function calculateSEOScore(article: {
  title: string;
  meta_description: string | null;
  content: string | null;
  keywords: string[] | null;
  featured_image_url: string | null;
}): SEOScoreDetails {
  const contentText = article.content || '';
  const wordCount = contentText.split(/\s+/).filter(w => w.length > 0).length;
  const keywords = article.keywords || [];
  
  // Title score (max 15)
  let titleScore = 0;
  const titleLen = article.title.length;
  const keywordInTitle = keywords.some(kw => article.title.toLowerCase().includes(kw.toLowerCase()));
  if (titleLen >= 50 && titleLen <= 60 && keywordInTitle) titleScore = 15;
  else if (titleLen >= 30 && titleLen <= 70) titleScore = keywordInTitle ? 10 : 8;
  else titleScore = 5;

  // Meta score (max 15)
  let metaScore = 0;
  const metaLen = (article.meta_description || '').length;
  const keywordInMeta = keywords.some(kw => (article.meta_description || '').toLowerCase().includes(kw.toLowerCase()));
  if (metaLen >= 140 && metaLen <= 160 && keywordInMeta) metaScore = 15;
  else if (metaLen >= 100 && metaLen <= 160) metaScore = keywordInMeta ? 10 : 8;
  else metaScore = metaLen > 0 ? 5 : 0;

  // Keywords score (max 15)
  let keywordScore = 0;
  if (keywords.length >= 3 && keywords.length <= 5) keywordScore = 15;
  else if (keywords.length >= 1) keywordScore = 8;

  // Content score (max 20)
  let contentScore = 0;
  if (wordCount >= 1500 && wordCount <= 2500) contentScore = 20;
  else if (wordCount >= 800) contentScore = 12;
  else if (wordCount > 2500) contentScore = 18;
  else contentScore = Math.min(wordCount / 100, 5);

  // Image score (max 15)
  const imageScore = article.featured_image_url ? 15 : 0;

  // Density would require more calculation, using simplified approach
  const densityScore = keywords.length > 0 ? 10 : 0;

  const total = Math.round(titleScore + metaScore + keywordScore + contentScore + imageScore + densityScore);
  
  return {
    titleScore,
    metaScore,
    contentScore,
    keywordScore,
    imageScore,
    total: Math.min(total, 100)
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current week boundaries
    const now = new Date();
    const weekEnd = new Date(now);
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    console.log(`[SEO Weekly Report] Running for week ${weekStart.toISOString().split('T')[0]} to ${weekEnd.toISOString().split('T')[0]}`);

    // Fetch active blogs with user info
    const { data: blogs, error: blogsError } = await supabase
      .from('blogs')
      .select('id, name, user_id');

    if (blogsError) throw blogsError;

    const reports = [];

    for (const blog of blogs || []) {
      console.log(`[SEO Weekly Report] Processing blog: ${blog.name} (${blog.id})`);

      // Fetch published articles
      const { data: articles } = await supabase
        .from('articles')
        .select('id, title, meta_description, content, keywords, featured_image_url')
        .eq('blog_id', blog.id)
        .eq('status', 'published');

      if (!articles || articles.length === 0) {
        console.log(`[SEO Weekly Report] No published articles for blog ${blog.name}`);
        continue;
      }

      // Calculate SEO scores
      const scoresWithArticles = articles.map(a => ({
        article: a,
        score: calculateSEOScore(a)
      }));

      const totalScore = scoresWithArticles.reduce((sum, s) => sum + s.score.total, 0);
      const avgScore = Math.round(totalScore / scoresWithArticles.length);
      
      // Find weak articles
      const weakArticles = scoresWithArticles
        .filter(s => s.score.total < 60)
        .slice(0, 5)
        .map(s => ({
          id: s.article.id,
          title: s.article.title,
          score: s.score.total
        }));

      // Compare with previous week
      const lastWeekDate = new Date(weekStart);
      lastWeekDate.setDate(lastWeekDate.getDate() - 7);
      
      const { data: prevReport } = await supabase
        .from('seo_weekly_reports')
        .select('avg_seo_score')
        .eq('blog_id', blog.id)
        .gte('week_start', lastWeekDate.toISOString())
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      const scoreChange = prevReport ? avgScore - prevReport.avg_seo_score : 0;

      // Generate suggestions
      const suggestions: string[] = [];
      if (weakArticles.length > 0) {
        suggestions.push(`${weakArticles.length} artigos precisam de otimização SEO`);
      }
      if (avgScore < 60) {
        suggestions.push('Use "Corrigir Todos com IA" para melhorar rapidamente');
      }
      if (avgScore >= 80) {
        suggestions.push('Excelente performance SEO! Continue assim.');
      }
      const articlesWithoutMeta = articles.filter(a => !a.meta_description || a.meta_description.length < 100);
      if (articlesWithoutMeta.length > 0) {
        suggestions.push(`${articlesWithoutMeta.length} artigos precisam de meta description`);
      }

      // Save report
      const reportData = {
        blog_id: blog.id,
        user_id: blog.user_id,
        total_articles: articles.length,
        avg_seo_score: avgScore,
        articles_below_60: weakArticles.length,
        score_change: scoreChange,
        weak_articles: weakArticles,
        top_suggestions: suggestions,
        week_start: weekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0],
        sent_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('seo_weekly_reports')
        .insert(reportData);

      if (insertError) {
        console.error(`[SEO Weekly Report] Failed to save report for ${blog.name}:`, insertError);
        continue;
      }

      // Create internal notification
      const scoreEmoji = avgScore >= 80 ? '🌟' : avgScore >= 60 ? '📊' : '⚠️';
      const trendEmoji = scoreChange > 0 ? '↑' : scoreChange < 0 ? '↓' : '→';
      
      await supabase.from('automation_notifications').insert({
        user_id: blog.user_id,
        blog_id: blog.id,
        notification_type: 'seo_weekly_report',
        title: `${scoreEmoji} Relatório SEO Semanal`,
        message: `Score médio: ${avgScore}% ${trendEmoji} | ${weakArticles.length} artigos precisam de atenção`,
      });

      reports.push({
        blog_id: blog.id,
        blog_name: blog.name,
        avg_score: avgScore,
        weak_count: weakArticles.length
      });

      console.log(`[SEO Weekly Report] Report saved for ${blog.name}: avg=${avgScore}%, weak=${weakArticles.length}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        reports_generated: reports.length,
        reports 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[SEO Weekly Report] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
