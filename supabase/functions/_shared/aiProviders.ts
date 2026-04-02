/**
 * AI Providers Layer - OmniSeen
 * 
 * REGRA ABSOLUTA: Este é o ÚNICO ponto de entrada para chamadas de IA.
 * Nenhum fetch direto para OpenAI, Google, Perplexity ou Gateway fora deste arquivo.
 * Nenhum modelo hardcoded em outros lugares.
 * Qualquer novo uso de IA obrigatoriamente passa por este provider layer.
 */

import { 
  AI_CONFIG, 
  getProviderApiKey, 
  logAICall,
  type AICallResult,
  type SupportedProvider 
} from './aiConfig.ts';

// ============================================================================
// TYPES
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface WriterRequest {
  messages: ChatMessage[];
  tool?: {
    name: string;
    schema: Record<string, unknown>;
  };
  temperature?: number;
  maxTokens?: number;
}

export interface WriterResponse {
  content?: string;
  toolCall?: {
    name: string;
    arguments: Record<string, unknown>;
  };
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface ResearchRequest {
  query: string;
  systemPrompt?: string;
  maxTokens?: number;
}

export interface ResearchResponse {
  content: string;
  citations?: string[];
  facts?: string[];
  trends?: string[];
  sources?: string[];
}

export interface QARequest {
  systemPrompt: string;
  userPrompt: string;
}

export interface QAResponse {
  approved: boolean;
  score: number;
  issues: Array<{ code: string; message: string }>;
}

export interface ImageRequest {
  prompt: string;
  context: string;
  niche: string;
  city: string;
}

export interface ImageResponse {
  url: string;
  generatedBy: 'gemini_image' | 'unsplash_fallback';
}

// ============================================================================
// HELPER: Timeout wrapper
// ============================================================================

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ============================================================================
// WRITER: OpenAI GPT-4.1 (Primary) → Google Gemini (Fallback)
// ============================================================================

async function callOpenAIWriter(request: WriterRequest): Promise<WriterResponse> {
  const config = AI_CONFIG.writer.primary;
  const apiKey = getProviderApiKey('openai');
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const writerFallback = AI_CONFIG.writer.fallback;
  
  const body: Record<string, unknown> = {
    model: writerFallback.model,
    messages: request.messages,
    temperature: request.temperature ?? writerFallback.temperature,
    max_tokens: request.maxTokens ?? writerFallback.maxTokens,
  };
  
  // Add tool if provided - OpenAI requires 'description' field
  if (request.tool) {
    body.tools = [{
      type: 'function',
      function: {
        name: request.tool.name,
        description: `Generate structured ${request.tool.name} output`,
        parameters: request.tool.schema
      }
    }];
    body.tool_choice = { type: 'function', function: { name: request.tool.name } };
  } else {
    body.response_format = writerFallback.responseFormat;
  }
  
  const response = await fetchWithTimeout(
    config.endpoint,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    },
    60000 // 60s timeout for writer
  );
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenAI error ${response.status}: ${errorText.substring(0, 200)}`);
  }
  
  const data = await response.json();
  
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall) {
    return {
      toolCall: {
        name: toolCall.function.name,
        arguments: JSON.parse(toolCall.function.arguments)
      },
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens
      }
    };
  }
  
  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: {
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
      totalTokens: data.usage?.total_tokens
    }
  };
}

async function callGoogleWriter(request: WriterRequest): Promise<WriterResponse> {
  const config = AI_CONFIG.writer.primary;
  const apiKey = getProviderApiKey('gemini');
  
  if (!apiKey) {
    throw new Error('GOOGLE_AI_KEY not configured');
  }
  
  // Convert messages to Google format
  const contents = request.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));
  
  const systemInstruction = request.messages.find(m => m.role === 'system')?.content;
  
  const url = `${config.endpoint}/${config.model}:generateContent?key=${apiKey}`;
  
  const generationConfig: Record<string, unknown> = {
    temperature: request.temperature ?? config.temperature,
    maxOutputTokens: request.maxTokens ?? config.maxOutputTokens,
  };
  
  // Only set responseMimeType when NOT using tool/function calling
  // Google API rejects combining forced function calling (ANY mode) with responseMimeType: 'application/json'
  if (!request.tool) {
    generationConfig.responseMimeType = 'application/json';
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig
  };
  
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  
  // Add tool if provided - Google requires specific schema format
  if (request.tool) {
    // Google API requires type: "object" at root level, not "function"
    const cleanSchema = { ...request.tool.schema };
    
    if (cleanSchema.type === 'function' || !cleanSchema.type) {
      cleanSchema.type = 'object';
    }
    
    delete cleanSchema.additionalProperties;
    
    body.tools = [{
      functionDeclarations: [{
        name: request.tool.name,
        description: `Generate ${request.tool.name} content`,
        parameters: cleanSchema
      }]
    }];
    body.toolConfig = {
      functionCallingConfig: {
        mode: 'ANY',
        allowedFunctionNames: [request.tool.name]
      }
    };
  }
  
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }, 60000);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Google error ${response.status}: ${errorText.substring(0, 200)}`);
  }
  
  const data = await response.json();
  
  const functionCall = data.candidates?.[0]?.content?.parts?.[0]?.functionCall;
  if (functionCall) {
    return {
      toolCall: {
        name: functionCall.name,
        arguments: functionCall.args
      },
      usage: {
        totalTokens: data.usageMetadata?.totalTokenCount
      }
    };
  }
  
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return {
    content: text,
    usage: {
      totalTokens: data.usageMetadata?.totalTokenCount
    }
  };
}

/**
 * WRITER ENTRY POINT
 * Primary: OpenAI GPT-4.1
 * Fallback: Google Gemini 2.0 Flash
 */
export async function callWriter(request: WriterRequest): Promise<AICallResult<WriterResponse>> {
  const start = Date.now();
  
  // Try Gemini first (primary)
  try {
    console.log('[AI_CONFIG] Writer: Calling Google Gemini...');
    const result = await callGoogleWriter(request);
    const duration = Date.now() - start;
    logAICall('writer', 'gemini', true, duration);
    
    return {
      success: true,
      data: result,
      provider: 'gemini',
      usedFallback: false,
      durationMs: duration,
      usage: result.usage
    };
  } catch (geminiError) {
    const errorMsg = geminiError instanceof Error ? geminiError.message : 'Unknown error';
    console.warn(`[AI_CONFIG] Writer: Gemini failed - ${errorMsg}`);
    console.log('[AI_CONFIG] Writer: Falling back to OpenAI...');
    
    // Fallback to OpenAI
    try {
      const result = await callOpenAIWriter(request);
      const duration = Date.now() - start;
      logAICall('writer', 'openai', true, duration, true);
      
      return {
        success: true,
        data: result,
        provider: 'openai',
        usedFallback: true,
        fallbackReason: errorMsg,
        durationMs: duration,
        usage: result.usage
      };
    } catch (openaiError) {
      const duration = Date.now() - start;
      const fallbackError = openaiError instanceof Error ? openaiError.message : 'Unknown error';
      logAICall('writer', 'openai', false, duration, true, fallbackError);
      
      return {
        success: false,
        provider: 'openai',
        usedFallback: true,
        fallbackReason: `Primary: ${errorMsg}, Fallback: ${fallbackError}`,
        durationMs: duration
      };
    }
  }
}

// callPerplexityResearch removida — Perplexity não está no aiConfig.ts desta fase.
// Research primário = Google Gemini com Grounding (aiConfig.research.primary)

async function callGoogleResearch(request: ResearchRequest): Promise<ResearchResponse> {
  // Usa a config PRIMARY (Gemini com grounding) — NÃO a fallback
  const config = AI_CONFIG.research.primary;
  const apiKey = getProviderApiKey('gemini');

  if (!apiKey) {
    throw new Error('GOOGLE_AI_KEY not configured');
  }

  const systemPrompt = request.systemPrompt ||
    `Você é um pesquisador especializado em SEO local. Retorne dados factuais em JSON:
    {"facts": [...], "trends": [...], "sources": [...]}`;

  const url = `${config.endpoint}/${config.model}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: request.query }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: request.maxTokens || 1500,
      // Sem responseMimeType quando grounding está ativo (incompatível com Google Search)
    },
    // Grounding via Google Search — dados reais da internet
    tools: [{ googleSearch: {} }],
  };
  
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }, 45000);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Google error ${response.status}: ${errorText.substring(0, 200)}`);
  }
  
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  // Extract grounding sources if available
  const groundingMetadata = data.candidates?.[0]?.groundingMetadata;
  const sources = groundingMetadata?.webSearchQueries || [];
  
  // Try to parse JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        content: text,
        facts: parsed.facts || [],
        trends: parsed.trends || [],
        sources: parsed.sources || sources
      };
    } catch {
      // Return raw content
    }
  }
  
  return { content: text, sources };
}

/**
 * RESEARCH ENTRY POINT
 * Primary:  Google Gemini 2.5 Flash com Google Search Grounding
 * Fallback: OpenAI GPT-4.1 (pesquisa baseada em conhecimento)
 *
 * NOTA: Perplexity foi removido do aiConfig.ts — Gemini grounding é o primário.
 */
export async function callResearch(request: ResearchRequest): Promise<AICallResult<ResearchResponse>> {
  const start = Date.now();

  // Primary: Gemini com Google Search Grounding (dados reais da internet)
  try {
    console.log('[AI_CONFIG] Research: Calling Google Gemini (Grounding)...');
    const result = await callGoogleResearch(request);
    const duration = Date.now() - start;
    logAICall('research', 'gemini', true, duration);

    return {
      success: true,
      data: result,
      provider: 'gemini',
      usedFallback: false,
      durationMs: duration,
    };
  } catch (geminiError) {
    const geminiMsg = geminiError instanceof Error ? geminiError.message : 'Unknown error';
    console.warn(`[AI_CONFIG] Research: Gemini failed (${Date.now() - start}ms) - ${geminiMsg}`);
    console.log('[AI_CONFIG] Research: Falling back to OpenAI GPT-4.1...');

    // Fallback: OpenAI como pesquisa baseada em conhecimento parametrizado
    try {
      const config = AI_CONFIG.research.fallback;
      const apiKey = getProviderApiKey('openai');
      if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

      const systemPrompt = request.systemPrompt ||
        `Você é um pesquisador especializado. Retorne dados factuais em JSON:
        {"facts": [...], "trends": [...], "sources": [...]}`;

      const oaRes = await fetchWithTimeout(
        config.endpoint,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: request.query },
            ],
            temperature: config.temperature ?? 0.3,
            max_tokens: request.maxTokens || 1000,
            response_format: { type: 'json_object' },
          }),
        },
        30000
      );

      if (!oaRes.ok) {
        const errText = await oaRes.text().catch(() => '');
        throw new Error(`OpenAI error ${oaRes.status}: ${errText.substring(0, 200)}`);
      }

      const oaData = await oaRes.json();
      const content = oaData.choices?.[0]?.message?.content || '{}';
      let parsed: ResearchResponse = { content };
      try {
        const obj = JSON.parse(content);
        parsed = { content, facts: obj.facts || [], trends: obj.trends || [], sources: obj.sources || [] };
      } catch { /* keep raw content */ }

      const duration = Date.now() - start;
      logAICall('research', 'openai', true, duration, true);

      return {
        success: true,
        data: parsed,
        provider: 'openai',
        usedFallback: true,
        fallbackReason: geminiMsg,
        durationMs: duration,
      };
    } catch (openaiError) {
      const duration = Date.now() - start;
      const fallbackError = openaiError instanceof Error ? openaiError.message : 'Unknown error';
      logAICall('research', 'openai', false, duration, true, fallbackError);

      return {
        success: false,
        provider: 'openai',
        usedFallback: true,
        fallbackReason: `Gemini: ${geminiMsg} | OpenAI: ${fallbackError}`,
        durationMs: duration,
      };
    }
  }
}

// ============================================================================
// QA: Google Gemini (Primary) → OpenAI GPT-4.1 (Fallback)
// ============================================================================

async function callGoogleQA(request: QARequest): Promise<QAResponse> {
  const config = AI_CONFIG.qa.fallback;
  const apiKey = getProviderApiKey('gemini');
  
  if (!apiKey) {
    throw new Error('GOOGLE_AI_KEY not configured');
  }
  
  const url = `${config.endpoint}/${config.model}:generateContent?key=${apiKey}`;
  
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: request.userPrompt }] }],
      systemInstruction: { parts: [{ text: request.systemPrompt }] },
      generationConfig: {
        temperature: config.temperature,
        responseMimeType: 'application/json'
      }
    })
  }, 30000);
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Google error ${response.status}: ${errorText.substring(0, 200)}`);
  }
  
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  
  const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim());
  
  return {
    approved: !!parsed.approved,
    score: typeof parsed.score === 'number' ? parsed.score : 0,
    issues: Array.isArray(parsed.issues) ? parsed.issues : []
  };
}

async function callOpenAIQA(request: QARequest): Promise<QAResponse> {
  const config = AI_CONFIG.qa.fallback;
  const apiKey = getProviderApiKey('openai');
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  
  const response = await fetchWithTimeout(
    config.endpoint,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: request.systemPrompt },
          { role: 'user', content: request.userPrompt }
        ],
        temperature: config.temperature,
        response_format: config.responseFormat
      })
    },
    30000
  );
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenAI error ${response.status}: ${errorText.substring(0, 200)}`);
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);
  
  return {
    approved: !!parsed.approved,
    score: typeof parsed.score === 'number' ? parsed.score : 0,
    issues: Array.isArray(parsed.issues) ? parsed.issues : []
  };
}

/**
 * QA ENTRY POINT
 * Primary: Google Gemini 2.0 Flash
 * Fallback: OpenAI GPT-4.1
 */
export async function callQA(request: QARequest): Promise<AICallResult<QAResponse>> {
  const start = Date.now();
  
  // Try OpenAI first (primary for QA — higher quality judgment)
  try {
    console.log('[AI_CONFIG] QA: Calling OpenAI GPT-4.1...');
    const result = await callOpenAIQA(request);
    const duration = Date.now() - start;
    logAICall('qa', 'openai', true, duration);
    
    return {
      success: true,
      data: result,
      provider: 'openai',
      usedFallback: false,
      durationMs: duration
    };
  } catch (openaiError) {
    const errorMsg = openaiError instanceof Error ? openaiError.message : 'Unknown error';
    console.warn(`[AI_CONFIG] QA: OpenAI failed - ${errorMsg}`);
    console.log('[AI_CONFIG] QA: Falling back to Gemini...');
    
    // Fallback to Gemini
    try {
      const result = await callGoogleQA(request);
      const duration = Date.now() - start;
      logAICall('qa', 'gemini', true, duration, true);
      
      return {
        success: true,
        data: result,
        provider: 'gemini',
        usedFallback: true,
        fallbackReason: errorMsg,
        durationMs: duration
      };
    } catch (geminiError) {
      const duration = Date.now() - start;
      const fallbackError = geminiError instanceof Error ? geminiError.message : 'Unknown error';
      logAICall('qa', 'gemini', false, duration, true, fallbackError);
      
      return {
        success: false,
        provider: 'gemini',
        usedFallback: true,
        fallbackReason: `Primary: ${errorMsg}, Fallback: ${fallbackError}`,
        durationMs: duration
      };
    }
  }
}

// ============================================================================
// IMAGES: Gemini Image Direct API (Primary) → Unsplash (Fallback)
// ============================================================================

import { generateImage as omniseenGenerateImage } from './omniseen-ai.ts';

async function callGeminiDirectImage(request: ImageRequest): Promise<ImageResponse> {
  const enhancedPrompt = `Professional business photography: ${request.prompt}. 
Context: ${request.context} service in ${request.city}. 
Industry: ${request.niche}.
Style: High-quality, photorealistic, modern, professional lighting. 
16:9 aspect ratio for web.`;

  const result = await omniseenGenerateImage(enhancedPrompt);

  if (!result.success || !result.url) {
    throw new Error(result.error || 'Gemini Image generation failed');
  }

  return {
    url: result.url,
    generatedBy: result.model === 'picsum-fallback' ? 'unsplash_fallback' : 'gemini_image',
  };
}

// V4.1: Exported for use in main flow for image timeout fallback
export function generateUnsplashFallback(request: ImageRequest): ImageResponse {
  const nicheKeywords: Record<string, string> = {
    'pest_control': 'pest control,exterminator,professional cleaning',
    'plumbing': 'plumber,plumbing,pipes,water',
    'dental': 'dentist,dental clinic,smile,teeth',
    'legal': 'lawyer,law office,legal,justice',
    'accounting': 'accountant,finance,business,office',
    'real_estate': 'real estate,house,property,home',
    'technology': 'technology,software,computer,office'
  };
  
  const nicheQuery = nicheKeywords[request.niche] || request.niche || 'professional,business';
  const keywords = [nicheQuery, 'professional', request.context || 'service']
    .filter(Boolean)
    .join(',');
  
  const config = AI_CONFIG.images.fallback;
  const url = `${config.apiUrl}/${config.size}/?${encodeURIComponent(keywords)}&sig=${Date.now()}-${Math.random().toString(36).substring(7)}`;
  
  return { url, generatedBy: 'unsplash_fallback' };
}

/**
 * IMAGE GENERATION ENTRY POINT
 * Primary: Lovable Gateway (Gemini Image)
 * Fallback: Unsplash
 */
export async function callImageGeneration(request: ImageRequest): Promise<AICallResult<ImageResponse>> {
  const start = Date.now();
  
  // Try Gemini Direct API first
  try {
    console.log('[AI_CONFIG] Images: Calling Gemini Image API...');
    const result = await callGeminiDirectImage(request);
    const duration = Date.now() - start;
    logAICall('images', 'gemini', true, duration);
    
    return {
      success: true,
      data: result,
      provider: 'gemini',
      usedFallback: false,
      durationMs: duration
    };
  } catch (geminiError) {
    const errorMsg = geminiError instanceof Error ? geminiError.message : 'Unknown error';
    console.warn(`[AI_CONFIG] Images: Gemini failed - ${errorMsg}`);
    console.log('[AI_CONFIG] Images: Falling back to Unsplash...');
    
    // Fallback to Unsplash (always succeeds)
    const result = generateUnsplashFallback(request);
    const duration = Date.now() - start;
    logAICall('images', 'unsplash', true, duration, true);
    
    return {
      success: true,
      data: result,
      provider: 'unsplash',
      usedFallback: true,
      fallbackReason: errorMsg,
      durationMs: duration
    };
  }
}

/**
 * Generate multiple images for an article
 * Uses the unified provider layer
 */
export async function generateArticleImagesViaProvider(
  // deno-lint-ignore no-explicit-any
  article: any,
  niche: string,
  city: string
// deno-lint-ignore no-explicit-any
): Promise<any> {
  if (!Array.isArray(article.image_prompts) || article.image_prompts.length === 0) {
    console.log('[AI_CONFIG] Images: No image prompts to generate');
    return article;
  }
  
  console.log(`[AI_CONFIG] Images: Starting generation for ${article.image_prompts.length} images...`);
  
  for (let i = 0; i < article.image_prompts.length; i++) {
    const imgPrompt = article.image_prompts[i];
    
    console.log(`[AI_CONFIG] Images: Generating ${i + 1}/${article.image_prompts.length}...`);
    
    const result = await callImageGeneration({
      prompt: imgPrompt.prompt || `Professional ${imgPrompt.context || 'business'} image`,
      context: imgPrompt.context || 'business',
      niche,
      city
    });
    
    if (result.success && result.data) {
      imgPrompt.url = result.data.url;
      imgPrompt.generated_by = result.data.generatedBy;
    } else {
      // Use fallback directly if both failed
      const fallback = generateUnsplashFallback({ prompt: '', context: imgPrompt.context || 'business', niche, city });
      imgPrompt.url = fallback.url;
      imgPrompt.generated_by = fallback.generatedBy;
    }
    
    // Small delay between requests
    if (i < article.image_prompts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Set featured image
  if (!article.featured_image_url && article.image_prompts[0]) {
    article.featured_image_url = article.image_prompts[0].url;
    console.log('[AI_CONFIG] Images: Featured image set from first image prompt');
  }
  
  console.log(`[AI_CONFIG] Images: ✅ All ${article.image_prompts.length} images have URLs`);
  
  return article;
}
