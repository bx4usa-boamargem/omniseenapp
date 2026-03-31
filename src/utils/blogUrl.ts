/**
 * Utility functions for generating blog and article URLs
 * Supports custom domain when verified, platform subdomain, and fallback paths
 * 
 * REGRAS DE DOMÍNIO:
 * - omniseen.app = Landing page APENAS
 * - app.omniseen.app = Plataforma SaaS
 * - {slug}.app.omniseen.app = Blogs de subcontas
 */

import { SUBDOMAIN_SUFFIX } from './platformUrls';

export interface BlogWithDomain {
  slug: string;
  custom_domain?: string | null;
  domain_verified?: boolean | null;
  platform_subdomain?: string | null;
}

/**
 * Get internal fallback URL for an article (always works, uses /blog/:slug/:article path)
 */
export function getInternalArticleUrl(blogSlug: string, articleSlug: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/blog/${blogSlug}/${articleSlug}`;
  }
  return `/blog/${blogSlug}/${articleSlug}`;
}

/**
 * Get internal fallback URL for a blog homepage
 */
export function getInternalBlogUrl(blogSlug: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/blog/${blogSlug}`;
  }
  return `/blog/${blogSlug}`;
}

/**
 * Check if we're in a production Omniseen environment
 */
export function isProductionEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  // Inclui app.omniseen.app e subdomínios *.app.omniseen.app
  return host.endsWith('.omniseen.app') || host === 'omniseen.app';
}

/**
 * Normalize subdomain: remove any .app.omniseen.app or .omniseen.app suffix
 */
function normalizeSubdomain(subdomain: string | null | undefined): string | null {
  if (!subdomain) return null;
  return subdomain
    .replace('https://', '')
    .replace('http://', '')
    .replace('.app.omniseen.app', '')
    .replace('.omniseen.app', '')
    .replace(/\/$/, ''); // Remove trailing slash
}

function isPlatformOrPreviewHost(): boolean {
  if (typeof window === 'undefined') return false;

  const host = window.location.hostname;
  return (
    host === 'app.omniseen.app' ||
    host === 'omniseenapp.lovable.app' ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.includes('lovable.app') ||
    host.includes('lovableproject.com')
  );
}

/**
 * Get the base URL for a blog
 * Priority: 1. Custom domain (if verified), 2. Platform subdomain, 3. Fallback path
 */
export function getBlogUrl(blog: BlogWithDomain): string {
  // Priority 1: Verified custom domain
  if (blog.custom_domain && blog.domain_verified) {
    const cleanDomain = blog.custom_domain
      .replace('https://', '')
      .replace('http://', '')
      .replace(/\/$/, '');
    return `https://${cleanDomain}`;
  }
  
  // Priority 2: Preserve public-domain navigation only when already inside blog domain access
  if (!isPlatformOrPreviewHost() && isBlogDomainAccess()) {
    const subdomain = normalizeSubdomain(blog.platform_subdomain) || blog.slug;
    return `https://${subdomain}${SUBDOMAIN_SUFFIX}`;
  }
  
  // Priority 3: Fallback path (for dev/preview)
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/blog/${blog.slug}`;
  }
  
  return `/blog/${blog.slug}`;
}

/**
 * ALWAYS returns the canonical production URL for sharing/display
 * This URL is stable and does not change based on environment
 * Use this for copy, share, QR code, and display purposes
 */
export function getCanonicalBlogUrl(blog: BlogWithDomain): string {
  // Priority 1: Verified custom domain
  if (blog.custom_domain && blog.domain_verified) {
    const cleanDomain = blog.custom_domain
      .replace('https://', '')
      .replace('http://', '')
      .replace(/\/$/, '');
    return `https://${cleanDomain}`;
  }
  
  // Priority 2: Platform subdomain (already in full format or needs suffix)
  if (blog.platform_subdomain) {
    const subdomain = blog.platform_subdomain
      .replace('https://', '')
      .replace('http://', '')
      .replace(/\/$/, '');
    
    // If already in correct format, use directly
    if (subdomain.endsWith('.app.omniseen.app')) {
      return `https://${subdomain}`;
    }
    
    // If in old format, add correct suffix
    const cleanSlug = subdomain
      .replace('.app.omniseen.app', '')
      .replace('.omniseen.app', '');
    return `https://${cleanSlug}${SUBDOMAIN_SUFFIX}`;
  }
  
  // Priority 3: Fallback to slug with canonical suffix
  return `https://${blog.slug}${SUBDOMAIN_SUFFIX}`;
}

/**
 * ALWAYS returns the canonical production URL for an article
 * Use this for copy, share, and display purposes
 */
export function getCanonicalArticleUrl(blog: BlogWithDomain, articleSlug: string): string {
  const baseUrl = getCanonicalBlogUrl(blog);
  return `${baseUrl}/${articleSlug}`;
}

/**
 * Get the full URL for an article
 * Priority: 1. Custom domain, 2. Platform subdomain, 3. Fallback path
 */
export function getArticleUrl(blog: BlogWithDomain, articleSlug: string): string {
  // Priority 1: Verified custom domain
  if (blog.custom_domain && blog.domain_verified) {
    const cleanDomain = blog.custom_domain
      .replace('https://', '')
      .replace('http://', '')
      .replace(/\/$/, '');
    return `https://${cleanDomain}/${articleSlug}`;
  }
  
  // Priority 2: Preserve public-domain navigation only when already inside blog domain access
  if (!isPlatformOrPreviewHost() && isBlogDomainAccess()) {
    const subdomain = normalizeSubdomain(blog.platform_subdomain) || blog.slug;
    return `https://${subdomain}${SUBDOMAIN_SUFFIX}/${articleSlug}`;
  }
  
  // Priority 3: Fallback path (for dev/preview)
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/blog/${blog.slug}/${articleSlug}`;
  }
  
  return `/blog/${blog.slug}/${articleSlug}`;
}

/**
 * Get the relative path for an article link (for react-router)
 * For custom domains or platform subdomains, returns just the slug
 * For normal access, returns full /blog/slug/articleSlug path
 */
export function getArticlePath(blog: BlogWithDomain, articleSlug: string): string {
  if (isBlogDomainAccess()) {
    return `/${articleSlug}`;
  }
  
  return `/blog/${blog.slug}/${articleSlug}`;
}

/**
 * Get the relative path for blog home (for react-router)
 */
export function getBlogPath(blog: BlogWithDomain): string {
  if (isBlogDomainAccess()) {
    return `/`;
  }
  
  return `/blog/${blog.slug}`;
}

/**
 * Check if the current access is via a blog domain (custom domain or platform subdomain)
 * This is used for link generation within blog mode
 */
export function isBlogDomainAccess(): boolean {
  if (typeof window === 'undefined') return false;
  
  const host = window.location.hostname;
  
  // Development/platform hosts - never blog domain access
  const platformHosts = ['localhost', '127.0.0.1', '0.0.0.0', 'app.omniseen.app'];
  if (platformHosts.some(h => host === h || host.includes(h))) {
    return false;
  }
  
  // Lovable preview - never blog domain access
  if (host.includes('lovable.app') || host.includes('lovableproject.com')) {
    return false;
  }
  
  // Root omniseen domain - landing, not blog
  if (host === 'omniseen.app' || host === 'www.omniseen.app') {
    return false;
  }
  
  // Subdomínio de subconta ({slug}.app.omniseen.app) ou domínio customizado
  return true;
}

/**
 * Check if the current access is via a custom domain (not platform subdomain)
 */
export function isCustomDomainAccess(): boolean {
  if (typeof window === 'undefined') return false;
  
  const host = window.location.hostname;
  
  // If it ends with omniseen.app, it's not a custom domain
  if (host.endsWith('omniseen.app')) {
    return false;
  }
  
  // Check other known platform hosts
  const platformHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
  if (platformHosts.some(h => host.includes(h)) || host.includes('lovable.app') || host.includes('lovableproject.com')) {
    return false;
  }
  
  // Any other domain is potentially a custom domain
  return true;
}

/**
 * Get the current hostname
 */
export function getCurrentHostname(): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  // Lovable preview/project hostnames never resolve to a tenant — skip them
  if (host.endsWith('.lovableproject.com') || host.endsWith('.lovable.app')) {
    return '';
  }
  return host;
}
