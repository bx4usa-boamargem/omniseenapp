// Strategy Resolver - Garante que toda geração tenha uma estratégia válida
// Este módulo é crítico para o motor universal de conteúdo

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ClientStrategy } from './promptTypeCore.ts';

// Estratégia mínima default - usada quando nenhuma estratégia existe
const DEFAULT_STRATEGY: ClientStrategy = {
  empresa_nome: null,
  tipo_negocio: 'serviços',
  regiao_atuacao: 'Brasil',
  tipo_publico: 'B2B/B2C',
  nivel_consciencia: 'consciente_problema',
  nivel_conhecimento: 'iniciante',
  dor_principal: null,
  desejo_principal: null,
  o_que_oferece: null,
  principais_beneficios: null,
  diferenciais: null,
  acao_desejada: 'entre em contato',
  canal_cta: 'WhatsApp'
};

export interface StrategyResolution {
  strategy: ClientStrategy;
  isDefault: boolean;
  strategyId: string | null;
  source: 'client_strategy' | 'business_profile' | 'default';
}

/**
 * Resolve a estratégia do cliente para um blog.
 * SEMPRE retorna uma estratégia válida - nunca retorna null.
 * 
 * Ordem de resolução:
 * 1. Busca client_strategy existente
 * 2. Se não existe, mescla com business_profile
 * 3. Se nenhum existe, cria automaticamente com defaults
 * 
 * @param supabase - Cliente Supabase
 * @param blogId - ID do blog
 * @returns StrategyResolution com estratégia garantida
 */
export async function resolveStrategy(
  supabase: SupabaseClient,
  blogId: string
): Promise<StrategyResolution> {
  console.log(`[StrategyResolver] Resolving strategy for blog: ${blogId}`);

  // 1. Tentar buscar client_strategy existente
  const { data: existingStrategy, error: strategyError } = await supabase
    .from('client_strategy')
    .select('*')
    .eq('blog_id', blogId)
    .maybeSingle();

  if (strategyError) {
    console.error(`[StrategyResolver] Error fetching client_strategy:`, strategyError);
  }

  if (existingStrategy) {
    console.log(`[StrategyResolver] Found existing client_strategy: ${existingStrategy.id}`);
    return {
      strategy: existingStrategy as ClientStrategy,
      isDefault: false,
      strategyId: existingStrategy.id,
      source: 'client_strategy'
    };
  }

  // 2. Tentar buscar business_profile para mesclar com defaults
  const { data: profile, error: profileError } = await supabase
    .from('business_profile')
    .select('company_name, niche, tone_of_voice, target_audience, long_description')
    .eq('blog_id', blogId)
    .maybeSingle();

  if (profileError) {
    console.error(`[StrategyResolver] Error fetching business_profile:`, profileError);
  }

  // 3. Mesclar dados disponíveis com defaults
  const mergedStrategy: ClientStrategy = {
    ...DEFAULT_STRATEGY,
    empresa_nome: profile?.company_name || null,
    tipo_negocio: profile?.niche || DEFAULT_STRATEGY.tipo_negocio,
    tipo_publico: profile?.target_audience || DEFAULT_STRATEGY.tipo_publico,
    o_que_oferece: profile?.long_description || null
  };

  // 4. Auto-criar client_strategy no banco (persistência automática)
  const { data: created, error: createError } = await supabase
    .from('client_strategy')
    .insert({
      blog_id: blogId,
      empresa_nome: mergedStrategy.empresa_nome,
      tipo_negocio: mergedStrategy.tipo_negocio,
      regiao_atuacao: mergedStrategy.regiao_atuacao,
      tipo_publico: mergedStrategy.tipo_publico,
      nivel_consciencia: mergedStrategy.nivel_consciencia,
      nivel_conhecimento: mergedStrategy.nivel_conhecimento,
      dor_principal: mergedStrategy.dor_principal,
      desejo_principal: mergedStrategy.desejo_principal,
      o_que_oferece: mergedStrategy.o_que_oferece,
      principais_beneficios: mergedStrategy.principais_beneficios,
      diferenciais: mergedStrategy.diferenciais,
      acao_desejada: mergedStrategy.acao_desejada,
      canal_cta: mergedStrategy.canal_cta
    })
    .select('id')
    .single();

  if (createError) {
    console.error(`[StrategyResolver] Error creating client_strategy:`, createError);
    // Continuar mesmo com erro - usar estratégia em memória
    return {
      strategy: mergedStrategy,
      isDefault: true,
      strategyId: null,
      source: profile ? 'business_profile' : 'default'
    };
  }

  console.log(`[StrategyResolver] Created default strategy: ${created?.id} (source: ${profile ? 'business_profile' : 'default'})`);

  return {
    strategy: mergedStrategy,
    isDefault: true,
    strategyId: created?.id || null,
    source: profile ? 'business_profile' : 'default'
  };
}

/**
 * Retorna a estratégia default para uso em UI ou validações
 */
export function getDefaultStrategy(): ClientStrategy {
  return { ...DEFAULT_STRATEGY };
}
