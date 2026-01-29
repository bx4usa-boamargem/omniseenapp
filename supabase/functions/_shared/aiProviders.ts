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
// WRITER: OpenAI GPT-4o (Primary) → Google Gemini (Fallback)
// ============================================================================

async function callOpenAIWriter(request: WriterRequest): Promise<WriterResponse> {
  const config = AI_CONFIG.writer.primary;
  const apiKey = getProviderApiKey('openai');
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  
  const body: Record<string, unknown> = {
    model: config.model,
    messages: request.messages,
    temperature: request.temperature ?? config.temperature,
    max_tokens: request.maxTokens ?? config.maxTokens,
  };
  
  // Add tool if provided
  if (request.tool) {
    body.tools = [{
      type: 'function',
      function: {
        name: request.tool.name,
        parameters: request.tool.schema
      }
    }];
    body.tool_choice = { type: 'function', function: { name: request.tool.name } };
  } else {
    body.response_format = config.responseFormat;
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
  const config = AI_CONFIG.writer.fallback;
  const apiKey = getProviderApiKey('google');
  
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
  
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: request.temperature ?? config.temperature,
      maxOutputTokens: request.maxTokens ?? config.maxOutputTokens,
      responseMimeType: 'application/json'
    }
  };
  
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }
  
  // Add tool if provided - Google requires specific schema format
  if (request.tool) {
    // Google API requires type: "object" at root level, not "function"
    // Clean the schema to ensure compatibility
    const cleanSchema = { ...request.tool.schema };
    
    // Force type to "object" if it's "function" or missing
    if (cleanSchema.type === 'function' || !cleanSchema.type) {
      cleanSchema.type = 'object';
    }
    
    // Remove any OpenAI-specific fields that Google doesn't understand
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
 * Primary: OpenAI GPT-4o
 * Fallback: Google Gemini 2.0 Flash
 */
export async function callWriter(request: WriterRequest): Promise<AICallResult<WriterResponse>> {
  const start = Date.now();
  
  // Try OpenAI first
  try {
    console.log('[AI_CONFIG] Writer: Calling OpenAI GPT-4o...');
    const result = await callOpenAIWriter(request);
    const duration = Date.now() - start;
    logAICall('writer', 'openai', true, duration);
    
    return {
      success: true,
      data: result,
      provider: 'openai',
      usedFallback: false,
      durationMs: duration,
      usage: result.usage
    };
  } catch (openaiError) {
    const errorMsg = openaiError instanceof Error ? openaiError.message : 'Unknown error';
    console.warn(`[AI_CONFIG] Writer: OpenAI failed - ${errorMsg}`);
    console.log('[AI_CONFIG] Writer: Falling back to Google Gemini...');
    
    // Fallback to Google
    try {
      const result = await callGoogleWriter(request);
      const duration = Date.now() - start;
      logAICall('writer', 'google', true, duration, true);
      
      return {
        success: true,
        data: result,
        provider: 'google',
        usedFallback: true,
        fallbackReason: errorMsg,
        durationMs: duration,
        usage: result.usage
      };
    } catch (googleError) {
      const duration = Date.now() - start;
      const fallbackError = googleError instanceof Error ? googleError.message : 'Unknown error';
      logAICall('writer', 'google', false, duration, true, fallbackError);
      
      return {
        success: false,
        provider: 'google',
        usedFallback: true,
        fallbackReason: `Primary: ${errorMsg}, Fallback: ${fallbackError}`,
        durationMs: duration
      };
    }
  }
}

// ============================================================================
// RESEARCH: Perplexity Sonar-Pro (Primary) → Google Gemini (Fallback)
// ============================================================================

async function callPerplexityResearch(request: ResearchRequest): Promise<ResearchResponse> {
  const config = AI_CONFIG.research.primary;
  const apiKey = getProviderApiKey('perplexity');
  
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }
  
  const systemPrompt = request.systemPrompt || 
    `Você é um pesquisador especializado. Retorne dados factuais em JSON: 
    {"facts": [...], "trends": [...], "sources": [...]}`;
  
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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: request.query }
        ],
        temperature: 0.3,
        max_tokens: request.maxTokens || 1000
      })
    },
    45000 // 45s timeout for research
  );
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Perplexity error ${response.status}: ${errorText.substring(0, 200)}`);
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const citations = data.citations || [];
  
  // Try to parse JSON from content
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        content,
        citations,
        facts: parsed.facts || [],
        trends: parsed.trends || [],
        sources: parsed.sources || citations
      };
    } catch {
      // Return raw content if JSON parsing fails
    }
  }
  
  return { content, citations };
}

async function callGoogleResearch(request: ResearchRequest): Promise<ResearchResponse> {
  const config = AI_CONFIG.research.fallback;
  const apiKey = getProviderApiKey('google');
  
  if (!apiKey) {
    throw new Error('GOOGLE_AI_KEY not configured');
  }
  
  const systemPrompt = request.systemPrompt || 
    `Você é um pesquisador. Retorne dados factuais em JSON: 
    {"facts": [...], "trends": [...], "sources": [...]}`;
  
  const url = `${config.endpoint}/${config.model}:generateContent?key=${apiKey}`;
  
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: request.query }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: request.maxTokens || 1000,
      responseMimeType: 'application/json'
    }
  };
  
  // Add grounding if configured
  if (config.useGrounding) {
    body.tools = [{
      googleSearch: {}
    }];
  }
  
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
 * Primary: Perplexity Sonar-Pro
 * Fallback: Google Gemini with Grounding
 */
export async function callResearch(request: ResearchRequest): Promise<AICallResult<ResearchResponse>> {
  const start = Date.now();
  
  // Try Perplexity first
  try {
    console.log('[AI_CONFIG] Research: Calling Perplexity Sonar-Pro...');
    const result = await callPerplexityResearch(request);
    const duration = Date.now() - start;
    logAICall('research', 'perplexity', true, duration);
    
    return {
      success: true,
      data: result,
      provider: 'perplexity',
      usedFallback: false,
      durationMs: duration
    };
  } catch (perplexityError) {
    const errorMsg = perplexityError instanceof Error ? perplexityError.message : 'Unknown error';
    console.warn(`[AI_CONFIG] Research: Perplexity failed - ${errorMsg}`);
    console.log('[AI_CONFIG] Research: Falling back to Google Gemini with grounding...');
    
    // Fallback to Google
    try {
      const result = await callGoogleResearch(request);
      const duration = Date.now() - start;
      logAICall('research', 'google', true, duration, true);
      
      return {
        success: true,
        data: result,
        provider: 'google',
        usedFallback: true,
        fallbackReason: errorMsg,
        durationMs: duration
      };
    } catch (googleError) {
      const duration = Date.now() - start;
      const fallbackError = googleError instanceof Error ? googleError.message : 'Unknown error';
      logAICall('research', 'google', false, duration, true, fallbackError);
      
      return {
        success: false,
        provider: 'google',
        usedFallback: true,
        fallbackReason: `Primary: ${errorMsg}, Fallback: ${fallbackError}`,
        durationMs: duration
      };
    }
  }
}

// ============================================================================
// QA: Google Gemini (Primary) → OpenAI GPT-4o (Fallback)
// ============================================================================

async function callGoogleQA(request: QARequest): Promise<QAResponse> {
  const config = AI_CONFIG.qa.primary;
  const apiKey = getProviderApiKey('google');
  
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
 * Fallback: OpenAI GPT-4o
 */
export async function callQA(request: QARequest): Promise<AICallResult<QAResponse>> {
  const start = Date.now();
  
  // Try Google first
  try {
    console.log('[AI_CONFIG] QA: Calling Google Gemini...');
    const result = await callGoogleQA(request);
    const duration = Date.now() - start;
    logAICall('qa', 'google', true, duration);
    
    return {
      success: true,
      data: result,
      provider: 'google',
      usedFallback: false,
      durationMs: duration
    };
  } catch (googleError) {
    const errorMsg = googleError instanceof Error ? googleError.message : 'Unknown error';
    console.warn(`[AI_CONFIG] QA: Google failed - ${errorMsg}`);
    console.log('[AI_CONFIG] QA: Falling back to OpenAI GPT-4o...');
    
    // Fallback to OpenAI
    try {
      const result = await callOpenAIQA(request);
      const duration = Date.now() - start;
      logAICall('qa', 'openai', true, duration, true);
      
      return {
        success: true,
        data: result,
        provider: 'openai',
        usedFallback: true,
        fallbackReason: errorMsg,
        durationMs: duration
      };
    } catch (openaiError) {
      const duration = Date.now() - start;
      const fallbackError = openaiError instanceof Error ? openaiError.message : 'Unknown error';
      logAICall('qa', 'openai', false, duration, true, fallbackError);
      
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

// ============================================================================
// IMAGES: Lovable Gateway (Primary) → Unsplash (Fallback)
// ============================================================================

async function callLovableGatewayImage(request: ImageRequest): Promise<ImageResponse> {
  const config = AI_CONFIG.images.primary;
  const apiKey = getProviderApiKey('lovable-gateway');
  
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY not configured');
  }
  
  const enhancedPrompt = `Professional business photography: ${request.prompt}. 
Context: ${request.context} service in ${request.city}, Brazil. 
Industry: ${request.niche}.
Style: High-quality, photorealistic, modern, professional lighting. 
${config.aspectRatio} aspect ratio for web.
No text, no watermarks, no logos.`;
  
  const response = await fetchWithTimeout(
    config.gateway,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: enhancedPrompt }],
        modalities: config.modalities
      })
    },
    30000
  );
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Lovable Gateway error ${response.status}: ${errorText.substring(0, 200)}`);
  }
  
  const data = await response.json();
  const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  
  if (!imageUrl) {
    throw new Error('No image URL in Lovable Gateway response');
  }
  
  return { url: imageUrl, generatedBy: 'gemini_image' };
}

function generateUnsplashFallback(request: ImageRequest): ImageResponse {
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
  
  // Try Lovable Gateway first
  try {
    console.log('[AI_CONFIG] Images: Calling Lovable Gateway...');
    const result = await callLovableGatewayImage(request);
    const duration = Date.now() - start;
    logAICall('images', 'lovable-gateway', true, duration);
    
    return {
      success: true,
      data: result,
      provider: 'lovable-gateway',
      usedFallback: false,
      durationMs: duration
    };
  } catch (gatewayError) {
    const errorMsg = gatewayError instanceof Error ? gatewayError.message : 'Unknown error';
    console.warn(`[AI_CONFIG] Images: Lovable Gateway failed - ${errorMsg}`);
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
