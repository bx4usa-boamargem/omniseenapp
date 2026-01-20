/**
 * Constantes imutáveis de domínio da plataforma Omniseen
 * 
 * REGRAS ABSOLUTAS:
 * - omniseen.app = Landing page institucional APENAS
 * - app.omniseen.app = Plataforma SaaS (login, dashboard, admin)
 * - {slug}.app.omniseen.app = Subcontas (blog público + dashboard isolado)
 * 
 * NUNCA usar omniseen.app para links internos da plataforma!
 */

// Domínio base da plataforma SaaS
export const PLATFORM_BASE_URL = 'https://app.omniseen.app';

// Domínio da landing page institucional (marketing apenas)
export const LANDING_BASE_URL = 'https://omniseen.app';

// Sufixo para subdomínios de clientes
export const SUBDOMAIN_SUFFIX = '.app.omniseen.app';

// ============ Helpers de URL da Plataforma ============

/**
 * URL de login da plataforma
 */
export const getPlatformLoginUrl = (): string => `${PLATFORM_BASE_URL}/login`;

/**
 * URL do dashboard da plataforma
 */
export const getPlatformDashboardUrl = (): string => `${PLATFORM_BASE_URL}/client/dashboard`;

/**
 * URL de signup da plataforma
 */
export const getPlatformSignupUrl = (): string => `${PLATFORM_BASE_URL}/signup`;

/**
 * URL de reset de senha da plataforma
 */
export const getPlatformResetPasswordUrl = (): string => `${PLATFORM_BASE_URL}/reset-password`;

/**
 * Gera URL completa para um subdomínio de subconta
 * @example getSubdomainUrl('trulynolen') => 'https://trulynolen.app.omniseen.app'
 */
export const getSubdomainUrl = (slug: string): string => `https://${slug}${SUBDOMAIN_SUFFIX}`;

/**
 * Gera URL de login para um subdomínio específico
 * @example getSubdomainLoginUrl('trulynolen') => 'https://trulynolen.app.omniseen.app/login'
 */
export const getSubdomainLoginUrl = (slug: string): string => `${getSubdomainUrl(slug)}/login`;

/**
 * Gera URL de dashboard para um subdomínio específico
 * @example getSubdomainDashboardUrl('trulynolen') => 'https://trulynolen.app.omniseen.app/client/dashboard'
 */
export const getSubdomainDashboardUrl = (slug: string): string => `${getSubdomainUrl(slug)}/client/dashboard`;

// ============ Helpers de Validação ============

/**
 * Verifica se o hostname atual é da plataforma principal
 * APENAS app.omniseen.app, NÃO inclui subdomínios
 */
export const isPlatformHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'app.omniseen.app';
};

/**
 * Verifica se o hostname atual é um subdomínio de subconta
 * PADRÃO IMUTÁVEL: {slug}.app.omniseen.app
 * @example 'trulynolen.app.omniseen.app' => true
 * @example 'app.omniseen.app' => false
 * @example 'omniseen.app' => false
 */
export const isSubaccountHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  // Must end with .app.omniseen.app but NOT be app.omniseen.app itself
  return host.endsWith('.app.omniseen.app') && host !== 'app.omniseen.app';
};

/**
 * Verifica se o hostname atual é da landing page
 */
export const isLandingHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'omniseen.app' || host === 'www.omniseen.app';
};

/**
 * Verifica se o hostname atual é um domínio customizado (não omniseen)
 * @example 'blog.meusite.com.br' => true
 * @example 'trulynolen.app.omniseen.app' => false
 */
export const isCustomDomainHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  
  // Exclude all omniseen domains
  if (host.endsWith('omniseen.app') || host === 'omniseen.app') {
    return false;
  }
  
  // Exclude development/preview hosts
  const devHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
  if (devHosts.some(h => host.includes(h)) || host.includes('lovable.app') || host.includes('lovableproject.com')) {
    return false;
  }
  
  return true;
};

/**
 * Extrai o slug do subdomínio atual
 * @example 'trulynolen.app.omniseen.app' => 'trulynolen'
 * @example 'app.omniseen.app' => null
 */
export const extractSubdomainSlug = (): string | null => {
  if (!isSubaccountHost()) return null;
  const host = window.location.hostname;
  return host.replace('.app.omniseen.app', '');
};
