import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText, generateImage } from '../_shared/omniseen-ai.ts';


/**
 * Async image generation for articles.
 * Called fire-and-forget by the orchestrator.
 * Generates hero + section images and updates the article directly.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash';
async function generateOneImage(prompt: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: GEMINI_IMAGE_MODEL,
        messages: [{ role: "user", content: `Generate a professional, realistic 16:9 image for a blog. ${prompt}. Style: editorial, high quality. No text, no watermarks.` }],
        modalities: ["image", "text"],
      }),
    });
    if (!res.ok) {
      await res.text(); // consume body
      return null;
    }
    const data = await res.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl?.startsWith("data:")) return null;
    return imageUrl;
  } catch (e) {
    console.error("[AsyncImg] generateOneImage error:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function uploadBase64(supabase: any, base64Url: string, fileName: string): Promise<string | null> {
  const match = base64Url.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  const fmt = match[1];
  const bin = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  const fpath = `${fileName}.${fmt}`;
  await supabase.storage.from("article-images").upload(fpath, bin, { contentType: `image/${fmt}`, upsert: true });
  const { data: pub } = supabase.storage.from("article-images").getPublicUrl(fpath);
  return pub?.publicUrl || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const apiKey = Deno.env.get("GOOGLE_AI_KEY");
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { article_id, keyword, outline_h2, job_id, step_id, job_type } = await req.json();

    if (!article_id || !apiKey) {
      return new Response(JSON.stringify({ error: "Missing article_id or GOOGLE_AI_KEY" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[AsyncImg] Starting for article ${article_id}`);

    // Fetch article data
    const { data: article } = await supabase
      .from("articles")
      .select("title, content, slug")
      .eq("id", article_id)
      .single();

    const title = article?.title || keyword || "professional blog";
    const slug = (keyword || title || "img").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const html = article?.content || "";
    const sectionCount = (html.match(/<h2[^>]*>/gi) || []).length;
    const sections: string[] = Array.isArray(outline_h2) ? outline_h2.map((s: any) => s.title || s) : [];
    // Limit: article = 2 section images (+ 1 hero = 3 total), super_page = 3 section images (+ 1 hero = 4 total)
    const contentType = job_type || 'article';
    const maxImages = Math.min(sectionCount, contentType === 'super_page' ? 3 : 2);
    const totalImages = 1 + maxImages;

    // Mark pending
    await supabase.from("articles").update({
      images_pending: true,
      images_total: totalImages,
      images_completed: 0,
    }).eq("id", article_id);

    let completed = 0;

    // 1. Hero image
    console.log(`[AsyncImg] Generating hero...`);
    const heroBase64 = await generateOneImage(title, apiKey);
    let heroUrl: string | null = null;
    if (heroBase64) {
      heroUrl = await uploadBase64(supabase, heroBase64, `${article_id}-hero`);
    }
    if (!heroUrl) {
      heroUrl = `https://picsum.photos/seed/${slug}-hero/1024/576`;
    }
    completed++;
    await supabase.from("articles").update({
      featured_image_url: heroUrl,
      featured_image_alt: title,
      images_completed: completed,
    }).eq("id", article_id);
    console.log(`[AsyncImg] Hero done: ${completed}/${totalImages}`);

    // 2. Section images
    const contentImages: { context: string; url: string; alt: string; after_section: number }[] = [];
    for (let i = 0; i < maxImages; i++) {
      const sectionTitle = sections[i] || `Section ${i + 1}`;
      const prompt = `${keyword || title}, ${sectionTitle}. Editorial, realistic.`;
      console.log(`[AsyncImg] Generating section ${i + 1}/${maxImages}...`);

      const imgBase64 = await generateOneImage(prompt, apiKey);
      let url: string;
      if (imgBase64) {
        const uploaded = await uploadBase64(supabase, imgBase64, `${article_id}-section-${i + 1}-${Date.now()}`);
        url = uploaded || `https://picsum.photos/seed/${slug}-sec-${i}/800/450`;
      } else {
        url = `https://picsum.photos/seed/${slug}-sec-${i}/800/450`;
      }
      contentImages.push({ context: sectionTitle, url, alt: sectionTitle, after_section: i + 1 });
      completed++;

      // Update progress
      await supabase.from("articles").update({
        images_completed: completed,
        content_images: contentImages,
      }).eq("id", article_id);

      // Small delay to avoid rate limits
      if (i < maxImages - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    // 3. Mark completed
    await supabase.from("articles").update({
      images_pending: false,
      images_completed: completed,
      content_images: contentImages,
    }).eq("id", article_id);

    // Update step if provided
    if (step_id) {
      await supabase.from("generation_steps").update({
        status: "completed",
        output: { heroUrl, sectionCount: contentImages.length },
        completed_at: new Date().toISOString(),
        model_used: GEMINI_IMAGE_MODEL,
        provider: "gemini-nano-banana",
      }).eq("id", step_id);
    }

    console.log(`[AsyncImg] ✅ Done: ${completed} images for article ${article_id}`);

    return new Response(JSON.stringify({ success: true, completed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[AsyncImg] ❌ Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
