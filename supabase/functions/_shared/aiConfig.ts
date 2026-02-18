/**
 * Configuração de AIs - OmniSeen
 * Stack: OpenAI + Google + Perplexity + Unsplash
 * 100% Lovable-compatible
 * 
 * REGRA ABSOLUTA: Este é o arquivo de configuração oficial.
 * Todos os modelos, endpoints e chaves são definidos aqui.
 */

export const AI_CONFIG = {
  writer: {
    primary: {
      provider: 'openai' as const,
      model: 'gpt-4o-2024-11-20',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      temperature: 0.4,
      maxTokens: 8000,
      responseFormat: { type: 'json_object' }
    },
    fallback: {
      provider: 'google' as const,
      model: 'gemini-2.5-flash',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      temperature: 0.4,
      maxOutputTokens: 8192
    }
  },
  
  research: {
    primary: {
      provider: 'perplexity' as const,
      model: 'sonar-pro',
      endpoint: 'https://api.perplexity.ai/chat/completions',
      searchMode: 'web',
      citations: true
    },
    fallback: {
      provider: 'google' as const,
      model: 'gemini-2.5-flash',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      useGrounding: true,
      groundingSource: 'google_search'
    }
  },
  
  qa: {
    primary: {
      provider: 'google' as const,
      model: 'gemini-2.5-flash',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      temperature: 0.1,
      responseFormat: 'json'
    },
    fallback: {
      provider: 'openai' as const,
      model: 'gpt-4o-2024-11-20',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      temperature: 0.1,
      responseFormat: { type: 'json_object' }
    }
  },
  
  images: {
    primary: {
      provider: 'lovable-gateway' as const,
      model: 'google/gemini-2.5-flash-image',
      gateway: 'https://ai.gateway.lovable.dev/v1/chat/completions',
      aspectRatio: '16:9',
      modalities: ['image', 'text'] as const
    },
    fallback: {
      provider: 'unsplash' as const,
      apiUrl: 'https://picsum.photos',
      size: '1024x576',
      quality: 80
    }
  }
};

export const SUPPORTED_PROVIDERS = ['openai', 'google', 'perplexity', 'lovable-gateway', 'unsplash'] as const;

export type SupportedProvider = typeof SUPPORTED_PROVIDERS[number];

export type AIFunction = 'writer' | 'research' | 'qa' | 'images';

export interface AICallResult<T> {
  success: boolean;
  data?: T;
  provider: SupportedProvider;
  usedFallback: boolean;
  fallbackReason?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  durationMs: number;
}

// Utility: Get API key for a provider
export function getProviderApiKey(provider: SupportedProvider): string | undefined {
  switch (provider) {
    case 'openai':
      return Deno.env.get('OPENAI_API_KEY');
    case 'google':
      return Deno.env.get('GOOGLE_AI_KEY');
    case 'perplexity':
      return Deno.env.get('PERPLEXITY_API_KEY');
    case 'lovable-gateway':
      return Deno.env.get('LOVABLE_API_KEY');
    case 'unsplash':
      return 'none'; // Unsplash public API doesn't need key
    default:
      return undefined;
  }
}

// Check if all required API keys are configured
export function validateAPIKeys(): { valid: boolean; missing: string[] } {
  const required: SupportedProvider[] = ['openai', 'google', 'perplexity', 'lovable-gateway'];
  const missing: string[] = [];
  
  for (const provider of required) {
    const key = getProviderApiKey(provider);
    if (!key) {
      missing.push(provider);
    }
  }
  
  return { valid: missing.length === 0, missing };
}

// Log helper for AI calls
export function logAICall(
  fn: AIFunction,
  provider: SupportedProvider,
  success: boolean,
  durationMs: number,
  fallback: boolean = false,
  error?: string
): void {
  const status = success ? '✅' : '❌';
  const fallbackTag = fallback ? ' (FALLBACK)' : '';
  const errorMsg = error ? ` - ${error}` : '';
  console.log(`[AI_CONFIG] ${fn}: ${status} ${provider}${fallbackTag} in ${durationMs}ms${errorMsg}`);
}
