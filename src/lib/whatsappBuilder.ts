/**
 * WhatsApp Link Builder - Sistema Centralizado
 * 
 * Este módulo gerencia a construção de links WhatsApp com herança
 * da configuração global da conta-mãe.
 * 
 * REGRA ABSOLUTA: 
 * - Todos os links DEVEM usar wa.me - NUNCA api.whatsapp.com
 * - Nenhum link WhatsApp deve ser construído manualmente fora deste módulo
 * - Use SEMPRE as funções exportadas: buildSimpleWhatsAppLink, buildWhatsAppLinkWithMessage
 */

import { supabase } from "@/integrations/supabase/client";

// ============================================================
// INTERFACES
// ============================================================

export interface WhatsAppContext {
  phone: string;           // Obrigatório - número da subconta
  companyName?: string;    // Nome da empresa
  service?: string;        // Serviço principal
  city?: string;           // Cidade
  articleTitle?: string;   // Título do artigo (quando aplicável)
  // Campos territoriais
  neighborhood?: string;       // Bairro específico
  territoryName?: string;      // Nome oficial do território validado
  leadSource?: string;         // Origem: 'map' | 'article' | 'neighborhood' | 'search'
}

export interface GlobalCommConfig {
  whatsapp_base_url: string;
  message_template: string;
  placeholders: string[];
}

export interface BuildWhatsAppOptions {
  messageOverride?: string; // Mensagem específica (override do template global)
}

// ============================================================
// FUNÇÃO GLOBAL DE NORMALIZAÇÃO (ENTRADA À PROVA DE ERRO)
// ============================================================

/**
 * Normaliza qualquer formato de entrada de WhatsApp para número limpo
 * 
 * Aceita:
 * - +55 (11) 98888-7777
 * - 11988887777
 * - https://wa.me/5511988887777
 * - https://api.whatsapp.com/send?phone=5511988887777
 * 
 * Retorna: 5511988887777 (apenas dígitos, com código do país)
 * 
 * @throws Error se o número for inválido
 */
export function normalizeWhatsAppInput(raw: string): string {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Número de WhatsApp não informado');
  }
  
  // Extrai número de URLs wa.me ou api.whatsapp.com
  const urlMatch = raw.match(/(?:wa\.me\/|whatsapp\.com\/send\?phone=)(\d+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  
  // Remove todos os caracteres não numéricos
  const digits = raw.replace(/\D/g, '');
  
  // Valida e normaliza
  if (digits.length === 11) {
    // DDD + número celular sem código país -> adiciona 55 (Brasil)
    return `55${digits}`;
  }
  if (digits.length === 10) {
    // DDD + número fixo sem código país -> adiciona 55
    return `55${digits}`;
  }
  if (digits.length >= 12 && digits.length <= 15) {
    // Já tem código de país
    return digits;
  }
  
  throw new Error('Número inválido. Use DDD + número (ex: 11988887777)');
}

/**
 * Tenta normalizar sem lançar erro (retorna string vazia se falhar)
 */
export function tryNormalizeWhatsAppInput(raw: string): string {
  try {
    return normalizeWhatsAppInput(raw);
  } catch {
    return '';
  }
}

/**
 * Gera link wa.me com mensagem personalizada
 * ÚNICA função a ser usada para CTAs de artigo
 * 
 * @param phone - Número de WhatsApp em qualquer formato
 * @param message - Mensagem a ser enviada
 * @returns URL completa no formato https://wa.me/{numero}?text={mensagem}
 */
export function buildWhatsAppLinkWithMessage(phone: string, message: string): string {
  try {
    const cleanPhone = normalizeWhatsAppInput(phone);
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  } catch {
    console.warn('[WhatsApp] Invalid phone for message link:', phone);
    return '#';
  }
}

// ============================================================
// CONFIGURAÇÃO GLOBAL (CACHE)
// ============================================================

// Cache global para evitar múltiplas requests
let globalConfigCache: GlobalCommConfig | null = null;
let configFetchPromise: Promise<GlobalCommConfig> | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

/**
 * Configuração padrão (fallback) - COM PLACEHOLDERS TERRITORIAIS
 */
const DEFAULT_CONFIG: GlobalCommConfig = {
  whatsapp_base_url: 'https://wa.me/{phone}?text={message}',
  message_template: 'Olá! Encontrei sua empresa ao buscar por {service} em {neighborhood}. Li o artigo "{article_title}" no blog da unidade {territory_name} e gostaria de falar com um especialista local.',
  placeholders: ['phone', 'service', 'city', 'article_title', 'company_name', 'neighborhood', 'territory_name', 'lead_source']
};

/**
 * Busca configuração global da conta-mãe
 * Com cache para evitar múltiplas requests
 */
export async function getGlobalWhatsAppConfig(): Promise<GlobalCommConfig> {
  const now = Date.now();
  
  // Retorna cache se disponível e válido
  if (globalConfigCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return globalConfigCache;
  }
  
  // Evita múltiplas requests simultâneas
  if (configFetchPromise) {
    return configFetchPromise;
  }
  
  configFetchPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('global_comm_config')
        .select('whatsapp_base_url, message_template, placeholders')
        .eq('config_key', 'whatsapp_default')
        .eq('is_active', true)
        .single();
      
      if (error || !data) {
        console.warn('[WhatsApp] Failed to fetch global config, using defaults:', error);
        return DEFAULT_CONFIG;
      }
      
      globalConfigCache = {
        whatsapp_base_url: data.whatsapp_base_url,
        message_template: data.message_template,
        placeholders: data.placeholders as string[]
      };
      cacheTimestamp = Date.now();
      
      return globalConfigCache;
    } catch (err) {
      console.error('[WhatsApp] Error fetching global config:', err);
      return DEFAULT_CONFIG;
    } finally {
      configFetchPromise = null;
    }
  })();
  
  return configFetchPromise;
}

// ============================================================
// FUNÇÕES DE CONSTRUÇÃO DE LINKS
// ============================================================

/**
 * Limpa o número de telefone (apenas dígitos)
 * @deprecated Use normalizeWhatsAppInput para validação completa
 */
export function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Interpola placeholders no template de mensagem
 * Suporta placeholders territoriais (neighborhood, territory_name, lead_source)
 */
export function interpolateMessage(template: string, context: WhatsAppContext): string {
  const cleanPhone = cleanPhoneNumber(context.phone);
  
  // Fallback inteligente: usa neighborhood -> city -> default
  const locationFallback = context.neighborhood || context.city || 'sua região';
  const territoryFallback = context.territoryName || context.city || 'nossa unidade';
  
  return template
    .replace(/{phone}/g, cleanPhone)
    .replace(/{company_name}/g, context.companyName || 'nossa empresa')
    .replace(/{service}/g, context.service || 'nossos serviços')
    .replace(/{city}/g, context.city || 'sua região')
    .replace(/{article_title}/g, context.articleTitle || 'o conteúdo')
    // Placeholders territoriais
    .replace(/{neighborhood}/g, locationFallback)
    .replace(/{territory_name}/g, territoryFallback)
    .replace(/{lead_source}/g, context.leadSource || 'site');
}

/**
 * Constrói link WhatsApp com configuração global
 * Função assíncrona principal
 */
export async function buildWhatsAppLink(context: WhatsAppContext): Promise<string> {
  const cleanPhone = cleanPhoneNumber(context.phone);
  if (!cleanPhone || cleanPhone.length < 10) {
    return '#';
  }
  
  const config = await getGlobalWhatsAppConfig();
  return buildWhatsAppLinkSync(context, config);
}

/**
 * Versão síncrona quando a config já está disponível
 * Usada pelo hook useGlobalWhatsApp e pelos builders de backend
 */
export function buildWhatsAppLinkSync(
  context: WhatsAppContext, 
  config: GlobalCommConfig,
  options?: BuildWhatsAppOptions
): string {
  const cleanPhone = cleanPhoneNumber(context.phone);
  if (!cleanPhone || cleanPhone.length < 10) {
    console.warn('[WhatsApp] Invalid phone number:', context.phone);
    return '#';
  }
  
  // Se tem override, usa ele; senão, interpola template global
  const message = options?.messageOverride 
    ? options.messageOverride
    : interpolateMessage(config.message_template, { ...context, phone: cleanPhone });
  
  const url = config.whatsapp_base_url
    .replace('{phone}', cleanPhone)
    .replace('{message}', encodeURIComponent(message));
  
  return url;
}

/**
 * Gera apenas a URL do WhatsApp (sem mensagem)
 * Útil para links simples de contato
 */
export function buildSimpleWhatsAppLink(phone: string): string {
  try {
    const cleanPhone = normalizeWhatsAppInput(phone);
    return `https://wa.me/${cleanPhone}`;
  } catch {
    // Fallback para lógica antiga se normalização falhar
    const digits = phone.replace(/\D/g, '');
    if (!digits || digits.length < 10) {
      return '#';
    }
    return `https://wa.me/${digits}`;
  }
}

/**
 * Abre WhatsApp de forma resiliente
 * Trata popup blockers e navega diretamente se necessário
 */
export function openWhatsApp(url: string): void {
  if (!url || url === '#') {
    console.warn('[WhatsApp] Invalid URL, cannot open');
    return;
  }
  
  // Tenta abrir em nova aba
  const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
  
  // Se bloqueado por popup blocker, navega diretamente
  if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
    window.location.href = url;
  }
}

/**
 * Invalida o cache de configuração
 * Útil quando a configuração global é atualizada
 */
export function invalidateWhatsAppConfigCache(): void {
  globalConfigCache = null;
  configFetchPromise = null;
  cacheTimestamp = 0;
}

// ============================================================
// EXPORTAÇÃO DO DEFAULT CONFIG (para uso em contactLinks)
// ============================================================

export { DEFAULT_CONFIG };
