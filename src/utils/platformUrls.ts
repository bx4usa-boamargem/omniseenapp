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
  
  // Log para debug em produção
  console.log('[platformUrls] isSubaccountHost check:', { 
    host, 
    endsWithSuffix: host.endsWith('.app.omniseen.app'),
    isNotMain: host !== 'app.omniseen.app'
  });
  
  // Padrão principal: subdomínio do app.omniseen.app
  if (host.endsWith('.app.omniseen.app') && host !== 'app.omniseen.app') {
    return true;
  }
  
  // Fallback: verificar se há meta tag injetada pelo proxy
  const tenantMeta = document.querySelector('meta[name="x-tenant-slug"]');
  if (tenantMeta?.getAttribute('content')) {
    console.log('[platformUrls] isSubaccountHost: found tenant meta tag');
    return true;
  }
  
  return false;
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
  if (isDevHost()) {
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

// ============ Helpers de Resolução de Tenant via Proxy ============

/**
 * Lê o slug do tenant de uma meta tag injetada pelo reverse proxy (Cloudflare Worker)
 * Permite que o Worker injete o tenant real via HTML
 * @example <meta name="x-tenant-slug" content="trulynolen" />
 */
export const getTenantSlugFromMeta = (): string | null => {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector('meta[name="x-tenant-slug"]');
  return meta?.getAttribute('content') || null;
};

/**
 * Resolve o slug do tenant com prioridade:
 * 1. Meta tag injetada pelo Worker (x-tenant-slug)
 * 2. Parsing do hostname atual
 * 
 * Isso permite suporte tanto ao cenário atual (hostname parsing)
 * quanto ao cenário futuro (Cloudflare Worker com meta tag)
 */
export const resolveCurrentTenantSlug = (): string | null => {
  // Prioridade 1: Meta tag do Worker
  const metaSlug = getTenantSlugFromMeta();
  if (metaSlug) return metaSlug;
  
  // Prioridade 2: Parsing do hostname
  return extractSubdomainSlug();
};

// ============ Detecção de Ambiente Lovable ============

/**
 * Detecta se está em Preview do Lovable (ambiente de desenvolvimento)
 * Preview: id-preview--...lovable.app
 * Published: omniseenapp.lovable.app (NÃO é preview)
 * Dev: localhost
 */
export const isDevHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const hostname = window.location.hostname;
  return hostname.startsWith('id-preview--') || hostname.startsWith('preview--') || hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.vercel.app');
};

/** @deprecated Use isDevHost() instead */
export const isLovablePreviewHost = isDevHost;

/**
 * Converte path relativo para URL absoluta usando origin atual
 */
export const toAbsoluteUrl = (path: string): string => {
  if (typeof window === 'undefined') return path;
  return `${window.location.origin}${path}`;
};

// ============ Helpers de Navegação de Artigos ============

/**
 * Retorna path para lista de artigos
 */
export const getClientArticlesListPath = (): string => '/client/articles';

/**
 * Retorna path para criar novo artigo
 */
export const getClientArticleCreatePath = (): string => '/client/articles/engine/new';

/**
 * Retorna path para editar artigo
 */
export const getClientArticleEditPath = (articleId: string): string => {
  if (!articleId) {
    console.error('[getClientArticleEditPath] articleId is required');
    return '/client/articles';
  }
  return `/client/articles/${articleId}/edit`;
};

// ============ Navegação Inteligente ============

/**
 * Navega de forma inteligente baseado no ambiente:
 * - Preview/localhost: usa navigate() (SPA, sem reload)
 * - Published: usa window.location.assign() (hard reload, evita estado corrompido)
 */
export const smartNavigate = (
  navigate: (path: string) => void,
  path: string
): void => {
  if (isDevHost()) {
    navigate(path);
  } else {
    window.location.assign(toAbsoluteUrl(path));
  }
};
