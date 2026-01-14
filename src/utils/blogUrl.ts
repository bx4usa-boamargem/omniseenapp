/**
 * Utility functions for generating blog and article URLs
 * Supports custom domain when verified, platform subdomain, and fallback paths
 */

export interface BlogWithDomain {
  slug: string;
  custom_domain?: string | null;
  domain_verified?: boolean | null;
  platform_subdomain?: string | null;
}

/**
 * Check if we're in a production Omniseen environment
 */
export function isProductionEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.endsWith('omniseen.app');
}

/**
 * Get the base URL for a blog
 * Priority: 1. Custom domain (if verified), 2. Platform subdomain, 3. Fallback path
 */
/**
 * Normalize subdomain: remove any .omniseen.app suffix or https:// prefix
 */
function normalizeSubdomain(subdomain: string | null | undefined): string | null {
  if (!subdomain) return null;
  return subdomain
    .replace('https://', '')
    .replace('http://', '')
    .replace('.omniseen.app', '')
    .replace(/\/$/, ''); // Remove trailing slash
}

export function getBlogUrl(blog: BlogWithDomain): string {
  // Priority 1: Verified custom domain
  if (blog.custom_domain && blog.domain_verified) {
    const cleanDomain = blog.custom_domain
      .replace('https://', '')
      .replace('http://', '')
      .replace(/\/$/, '');
    return `https://${cleanDomain}`;
  }
  
  // Priority 2: Platform subdomain (only in production)
  if (isProductionEnvironment()) {
    const subdomain = normalizeSubdomain(blog.platform_subdomain) || blog.slug;
    return `https://${subdomain}.omniseen.app`;
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
  
  // Priority 2: ALWAYS use canonical format blog.omniseen.app/{slug}
  const slug = normalizeSubdomain(blog.platform_subdomain) || blog.slug;
  return `https://blog.omniseen.app/${slug}`;
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
  
  // Priority 2: Platform subdomain (only in production)
  if (isProductionEnvironment()) {
    const subdomain = normalizeSubdomain(blog.platform_subdomain) || blog.slug;
    return `https://${subdomain}.omniseen.app/${articleSlug}`;
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
  
  // Platform subdomain ({slug}.omniseen.app) or custom domain
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
  return window.location.hostname;
}
