/**
 * Configuração de AIs - OmniSeen v2
 * Stack: Google Gemini (Direct) + OpenAI GPT-4.1 (Direct)
 *
 * REGRA: Nenhuma dependência do Lovable AI Gateway.
 * REGRA: Sem Perplexity nesta fase.
 * REGRA: Sem GPT-4o nesta fase.
 * Todas as chamadas passam por omniseen-ai.ts.
 */

export const AI_CONFIG = {
  writer: {
    primary: {
      provider: 'gemini' as const,
      model: 'gemini-2.5-flash',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      temperature: 0.4,
      maxOutputTokens: 8192
    },
    fallback: {
      provider: 'openai' as const,
      model: 'gpt-4.1',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      temperature: 0.4,
      maxTokens: 8000,
      responseFormat: { type: 'json_object' }
    }
  },

  // Research: Gemini com Grounding (Perplexity removido nesta fase)
  research: {
    primary: {
      provider: 'gemini' as const,
      model: 'gemini-2.5-flash',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      useGrounding: true,
      groundingSource: 'google_search'
    },
    fallback: {
      provider: 'openai' as const,
      model: 'gpt-4.1',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      temperature: 0.3,
      maxTokens: 8000,
    }
  },

  qa: {
    primary: {
      provider: 'openai' as const,
      model: 'gpt-4.1',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      temperature: 0.1,
      maxTokens: 4000,
      responseFormat: { type: 'json_object' }
    },
    fallback: {
      provider: 'gemini' as const,
      model: 'gemini-2.5-flash',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      temperature: 0.1,
      maxOutputTokens: 4000,
      responseFormat: 'json'
    }
  },

  images: {
    primary: {
      provider: 'gemini' as const,
      model: 'gemini-2.5-flash',
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      aspectRatio: '16:9',
      responseModalities: ['IMAGE', 'TEXT'] as const
    },
    fallback: {
      provider: 'unsplash' as const,
      apiUrl: 'https://picsum.photos',
      size: '1024x576',
      quality: 80
    }
  }
};

// Apenas Gemini e OpenAI nesta fase (Perplexity removido)
export const SUPPORTED_PROVIDERS = ['openai', 'gemini', 'unsplash'] as const;

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
    case 'gemini':
      return Deno.env.get('GOOGLE_AI_KEY');
    case 'unsplash':
      return 'none'; // Picsum/Unsplash public API doesn't need key
    default:
      return undefined;
  }
}

// Check if all required API keys are configured
export function validateAPIKeys(): { valid: boolean; missing: string[] } {
  const required: SupportedProvider[] = ['openai', 'gemini'];
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
