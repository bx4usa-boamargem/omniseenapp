/**
 * Image Generator using Lovable AI (Gemini Image Model)
 * Generates images from prompts and uploads to Supabase Storage
 */

// deno-lint-ignore-file no-explicit-any
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ImageGenerationRequest {
  prompt: string;
  context: string;
  alt: string;
  aspectRatio?: '1:1' | '16:9' | '4:3';
  niche?: string;  // For niche-specific style optimization
}

export interface GeneratedImage {
  url: string;
  prompt: string;
  alt: string;
  context: string;
  generated_by: 'lovable_ai' | 'unsplash_fallback';
}

/**
 * Generate images using Lovable AI's Gemini image model
 * Falls back to Unsplash if generation fails
 */
export async function generateArticleImages(
  requests: ImageGenerationRequest[],
  blogId: string,
  slug: string
): Promise<GeneratedImage[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const results: GeneratedImage[] = [];
  
  console.log(`[ImageGenerator] Starting generation of ${requests.length} images...`);
  
  if (!LOVABLE_API_KEY) {
    console.warn('[ImageGenerator] LOVABLE_API_KEY not configured, using Unsplash fallback');
    return requests.map((req, idx) => createUnsplashFallback(req, blogId, idx));
  }
  
  for (let i = 0; i < requests.length; i++) {
    const request = requests[i];
    
    try {
      console.log(`[ImageGenerator] Generating image ${i + 1}/${requests.length}: "${request.context}"`);
      
      // Enhance prompt for better results
      const enhancedPrompt = buildEnhancedPrompt(request);
      
      // Call Lovable AI Gateway with image model
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image',
          messages: [
            {
              role: 'user',
              content: enhancedPrompt
            }
          ],
          modalities: ['image', 'text']
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ImageGenerator] API error ${response.status}:`, errorText);
        throw new Error(`AI API failed: ${response.status}`);
      }
      
      const data = await response.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (!imageUrl || !imageUrl.startsWith('data:image')) {
        throw new Error('No valid image returned from AI');
      }
      
      // Upload to Supabase Storage
      const publicUrl = await uploadImageToStorage(
        supabase,
        imageUrl,
        blogId,
        slug,
        i,
        request.context
      );
      
      results.push({
        url: publicUrl,
        prompt: request.prompt,
        alt: request.alt,
        context: request.context,
        generated_by: 'lovable_ai'
      });
      
      console.log(`[ImageGenerator] ✅ Generated image ${i + 1}: ${request.context}`);
      
      // Small delay to avoid rate limiting
      if (i < requests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
    } catch (error) {
      console.error(`[ImageGenerator] Failed image ${i + 1}:`, error);
      
      // Use Unsplash fallback
      results.push(createUnsplashFallback(request, blogId, i));
    }
  }
  
  console.log(`[ImageGenerator] Completed: ${results.filter(r => r.generated_by === 'lovable_ai').length}/${results.length} AI-generated`);
  return results;
}

/**
 * Build enhanced prompt for better image generation
 * Adds niche-specific styles and anti-futuristic rules
 */
function buildEnhancedPrompt(request: ImageGenerationRequest): string {
  const basePrompt = request.prompt;
  
  // Niche-specific style additions
  const nicheStyles: Record<string, string> = {
    pest_control: 'pest control service, professional technician with protective equipment, realistic urban work environment',
    plumbing: 'plumbing repair service, professional plumber with tools, realistic pipes and fixtures',
    roofing: 'roofing installation, professional roofer on roof, realistic construction scene with tiles',
    dental: 'modern dental clinic, professional dentist with patient, clean medical environment',
    legal: 'professional law office, business meeting, corporate legal setting with documents',
    accounting: 'professional accounting office, financial documents, modern corporate desk',
    real_estate: 'real estate property, professional agent showing home, beautiful residential area',
    automotive: 'auto repair shop, professional mechanic working on vehicle, realistic garage tools',
    construction: 'construction site, professional builders at work, realistic heavy equipment',
    beauty: 'beauty salon interior, professional aesthetician with client, elegant spa environment',
    cleaning: 'professional cleaning service, uniformed cleaner with equipment, spotless environment',
    landscaping: 'landscaping service, gardener with tools, beautiful garden or lawn'
  };
  
  const nicheStyle = request.niche && nicheStyles[request.niche] 
    ? nicheStyles[request.niche] 
    : 'professional business setting, corporate environment';
  
  // Quality modifiers for photorealistic output
  const qualityModifiers = [
    'Professional editorial photography',
    'High resolution 4K quality',
    'Sharp focus with natural lighting',
    'Photorealistic documentary style',
    'Clean composition',
    '16:9 aspect ratio'
  ];
  
  // Anti-futuristic rules for realism (from NICHE_EAT_PHRASES memory)
  const restrictions = [
    'NO holograms or futuristic interfaces',
    'NO artificial glowing effects or neon',
    'NO sci-fi or fantasy elements',
    'NO text, logos, or watermarks',
    'NO stock photo poses or fake smiles',
    'Real photographic documentary style only'
  ];
  
  return `${qualityModifiers.join(', ')}. 

Generate: ${basePrompt}

Niche style: ${nicheStyle}

Context: ${request.context}

CRITICAL RESTRICTIONS: ${restrictions.join('. ')}.`;
}

/**
 * Upload base64 image to Supabase Storage
 */
async function uploadImageToStorage(
  supabase: any,
  base64Data: string,
  blogId: string,
  slug: string,
  index: number,
  context: string
): Promise<string> {
  // Remove data URL prefix
  const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
  
  // Convert to binary
  const binaryData = Uint8Array.from(atob(base64Clean), c => c.charCodeAt(0));
  
  // Generate unique filename
  const timestamp = Date.now();
  const safeContext = context.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30);
  const fileName = `${blogId}/${slug}-${safeContext}-${index}-${timestamp}.png`;
  
  // Upload to storage
  const { data, error } = await supabase.storage
    .from('article-images')
    .upload(fileName, binaryData, {
      contentType: 'image/png',
      cacheControl: '31536000', // 1 year
      upsert: false
    });
  
  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('article-images')
    .getPublicUrl(data.path);
  
  return urlData.publicUrl;
}

/**
 * Create Unsplash fallback image
 */
function createUnsplashFallback(
  request: ImageGenerationRequest,
  blogId: string,
  index: number
): GeneratedImage {
  const keywords = [
    request.context,
    'business',
    'professional'
  ].filter(Boolean).join(',');
  
  const seed = `${blogId}-${index}-${Date.now()}`;
  
  return {
    url: `https://source.unsplash.com/1024x768/?${encodeURIComponent(keywords)}&sig=${seed}`,
    prompt: request.prompt,
    alt: request.alt,
    context: request.context,
    generated_by: 'unsplash_fallback'
  };
}

/**
 * Generate cover image specifically
 */
export async function generateCoverImage(
  prompt: string,
  alt: string,
  blogId: string,
  slug: string
): Promise<GeneratedImage> {
  const results = await generateArticleImages(
    [{
      prompt,
      context: 'hero-cover',
      alt,
      aspectRatio: '16:9'
    }],
    blogId,
    slug
  );
  
  return results[0];
}
