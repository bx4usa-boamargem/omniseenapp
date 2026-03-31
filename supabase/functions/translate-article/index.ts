import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const languageNames: Record<string, string> = {
  'en': 'English',
  'es': 'Spanish',
  'fr': 'French',
  'it': 'Italian',
  'pt-BR': 'Brazilian Portuguese'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { article_id, target_languages } = await req.json();

    if (!article_id || !target_languages || !Array.isArray(target_languages)) {
      return new Response(
        JSON.stringify({ error: 'article_id and target_languages array are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the original article
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('title, excerpt, content, meta_description, faq')
      .eq('id', article_id)
      .single();

    if (articleError || !article) {
      console.error('Error fetching article:', articleError);
      return new Response(
        JSON.stringify({ error: 'Article not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Record<string, { success: boolean; error?: string }> = {};

    for (const targetLang of target_languages) {
      try {
        console.log(`Translating article ${article_id} to ${targetLang}...`);
        
        const targetLanguageName = languageNames[targetLang] || targetLang;
        
        const prompt = `You are a professional translator. Translate the following blog article content from Portuguese to ${targetLanguageName}.

CRITICAL FORMAT RULES - READ CAREFULLY:
- The content is in MARKDOWN format. You MUST keep it in MARKDOWN format.
- Keep ## for H2 headings, ### for H3 headings
- Keep - or * for bullet points and lists
- Keep **text** for bold, *text* for italic
- Keep > for blockquotes
- Keep emoji prefixes exactly as they are (⚠️, 💡, 📌, 🎯, etc.)
- DO NOT convert to HTML. The output MUST be Markdown.
- Maintain the same tone, style, and paragraph structure
- Do not translate URLs, code snippets, or technical identifiers
- Adapt idioms and expressions naturally for the target language
- Ensure SEO optimization for the target language market
- For FAQ items, translate both questions and answers

Return a JSON object with these exact fields:
{
  "title": "translated title",
  "excerpt": "translated excerpt",
  "content": "translated content in MARKDOWN format (NOT HTML)",
  "meta_description": "translated meta description (max 160 characters)",
  "faq": [{"question": "translated question", "answer": "translated answer"}, ...]
}

ORIGINAL CONTENT (in Markdown):
Title: ${article.title}

Excerpt: ${article.excerpt || ''}

Meta Description: ${article.meta_description || ''}

FAQ: ${JSON.stringify(article.faq || [])}

Content (Markdown - keep this format):
${article.content || ''}`;

        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
          method: 'POST',
          headers: {
            // Authorization handled by omniseen-ai.ts internally,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'You are OMNISEEN AI, the intelligent virtual assistant of OMNISEEN. You are a professional translator. Always respond with valid JSON only, no markdown formatting.' },
              { role: 'user', content: prompt }
            ],
          }),
        });

        if (!response.ok) {
          if (response.status === 429) {
            results[targetLang] = { success: false, error: 'Rate limit exceeded' };
            continue;
          }
          if (response.status === 402) {
            results[targetLang] = { success: false, error: 'Payment required' };
            continue;
          }
          const errorText = await response.text();
          console.error(`AI gateway error for ${targetLang}:`, response.status, errorText);
          results[targetLang] = { success: false, error: 'AI translation failed' };
          continue;
        }

        const aiResponse = await response.json();
        const translatedContent = aiResponse.choices?.[0]?.message?.content;

        if (!translatedContent) {
          console.error(`No content in AI response for ${targetLang}`);
          results[targetLang] = { success: false, error: 'Empty AI response' };
          continue;
        }

        // Parse the JSON response (remove markdown code blocks if present)
        let parsedTranslation;
        try {
          let cleanJson = translatedContent.trim();
          if (cleanJson.startsWith('```json')) {
            cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          parsedTranslation = JSON.parse(cleanJson);
        } catch (parseError) {
          console.error(`Failed to parse translation for ${targetLang}:`, parseError);
          results[targetLang] = { success: false, error: 'Invalid translation format' };
          continue;
        }

        // Upsert the translation
        const { error: upsertError } = await supabase
          .from('article_translations')
          .upsert({
            article_id,
            language_code: targetLang,
            title: parsedTranslation.title || article.title,
            excerpt: parsedTranslation.excerpt || article.excerpt,
            content: parsedTranslation.content || article.content,
            meta_description: parsedTranslation.meta_description || article.meta_description,
            faq: parsedTranslation.faq || article.faq,
            translated_at: new Date().toISOString(),
            translated_by: 'ai',
            is_reviewed: false
          }, {
            onConflict: 'article_id,language_code'
          });

        if (upsertError) {
          console.error(`Error saving translation for ${targetLang}:`, upsertError);
          results[targetLang] = { success: false, error: 'Failed to save translation' };
          continue;
        }

        console.log(`Successfully translated article ${article_id} to ${targetLang}`);
        results[targetLang] = { success: true };

      } catch (langError) {
        console.error(`Error translating to ${targetLang}:`, langError);
        results[targetLang] = { success: false, error: String(langError) };
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in translate-article function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
