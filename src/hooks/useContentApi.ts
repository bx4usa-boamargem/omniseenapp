import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentHostname } from "@/utils/blogUrl";

// Types for Content API responses
export interface BlogMeta {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  dark_primary_color: string | null;
  dark_secondary_color: string | null;
  author_name: string | null;
  author_bio: string | null;
  author_photo_url: string | null;
  author_linkedin: string | null;
  banner_enabled: boolean | null;
  banner_title: string | null;
  banner_description: string | null;
  banner_image_url: string | null;
  header_cta_text: string | null;
  header_cta_url: string | null;
  footer_text: string | null;
  show_powered_by: boolean | null;
  layout_template: string | null;
  theme_mode: string | null;
  custom_domain: string | null;
  platform_subdomain: string | null;
}

export interface ArticleSummary {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  category: string | null;
  tags: string[] | null;
  published_at: string | null;
  reading_time: number | null;
}

export interface ArticleFull extends ArticleSummary {
  content: string | null;
  meta_description: string | null;
  keywords: string[] | null;
  view_count: number | null;
  updated_at: string | null;
  faq: { question: string; answer: string }[] | null;
  highlights: unknown | null;
  content_images: { context: string; url: string; after_section: number }[] | null;
  cta: {
    company_name?: string;
    phone?: string;
    whatsapp?: string;
    booking_url?: string;
    site?: string;
    email?: string;
  } | null;
}

export interface LandingPage {
  id: string;
  title: string;
  slug: string;
  page_data: unknown;
  seo_title: string | null;
  seo_description: string | null;
  featured_image_url: string | null;
  published_at: string | null;
  updated_at: string | null;
}

export interface AgentConfig {
  is_enabled: boolean;
  agent_name: string | null;
  agent_avatar_url: string | null;
  welcome_message: string | null;
  proactive_delay_seconds: number | null;
}

export interface BusinessProfile {
  company_name: string | null;
  logo_url: string | null;
  services: unknown | null;
  niche: string | null;
  city: string | null;
}

export interface TenantInfo {
  blog_id: string;
  tenant_id: string | null;
  domain: string;
  domain_type: "subdomain" | "custom";
}

interface ContentApiResponse<T> {
  tenant: TenantInfo;
  blog: BlogMeta | null;
  data: T;
}

type ContentRoute = 
  | "blog.home"
  | "blog.article"
  | "blog.category"
  | "blog.tag"
  | "blog.search"
  | "page.landing"
  | "page.landing.direct"
  | "sitemap.urls"
  | "agent.config";

/**
 * Fetch landing page directly by slug (bypasses tenant resolution)
 * Used when no blogSlug is available (e.g., /p/:pageSlug route)
 */
export async function fetchLandingPageDirect(
  pageSlug: string
): Promise<{ blog: BlogMeta | null; page: LandingPage | null; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("content-api", {
      body: { route: "page.landing.direct", params: { slug: pageSlug } },
    });

    if (error) {
      console.error("[useContentApi] Edge function error (direct):", error);
      return { blog: null, page: null, error: "Falha ao carregar página" };
    }

    if (data?.error) {
      return { blog: null, page: null, error: data.error };
    }

    return {
      blog: data?.blog || null,
      page: data?.data?.page || null,
    };
  } catch (err) {
    console.error("[useContentApi] Fetch error (direct):", err);
    return { blog: null, page: null, error: "Erro ao buscar página" };
  }
}

/**
 * Retry helper for edge function calls (handles WORKER_LIMIT / 5xx)
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 1500
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isRetryable =
        err instanceof Error &&
        (err.message?.includes("WORKER_LIMIT") ||
          err.message?.includes("546") ||
          err.message?.includes("502") ||
          err.message?.includes("503"));
      if (attempt < retries && isRetryable) {
        console.warn(`[useContentApi] Retry ${attempt + 1}/${retries} after error:`, err);
        await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Unreachable");
}

/**
 * Core function to call the content-api Edge Function
 */
export async function fetchContentApi<T>(
  route: ContentRoute,
  params: Record<string, unknown> = {},
  host?: string
): Promise<ContentApiResponse<T> | null> {
  const hostname = host || getCurrentHostname();
  
  if (!hostname) {
    console.error("[useContentApi] No hostname available");
    return null;
  }

  try {
    const { data, error } = await supabase.functions.invoke("content-api", {
      body: { host: hostname, route, params },
    });

    if (error) {
      // Check if retryable
      const errMsg = typeof error === "object" ? JSON.stringify(error) : String(error);
      if (errMsg.includes("WORKER_LIMIT") || errMsg.includes("546")) {
        throw new Error(errMsg); // Let retry wrapper handle it
      }
      console.error("[useContentApi] Edge function error:", error);
      return null;
    }

    return data as ContentApiResponse<T>;
  } catch (err) {
    console.error("[useContentApi] Fetch error:", err);
    return null;
  }
}

/**
 * Fetch content-api with direct blog_id (bypasses hostname resolution)
 * Useful when blogId is already known (e.g., from useDomainResolution)
 */
export async function fetchContentApiByBlogId<T>(
  route: ContentRoute,
  blogId: string,
  params: Record<string, unknown> = {}
): Promise<ContentApiResponse<T> | null> {
  try {
    const { data, error } = await supabase.functions.invoke("content-api", {
      body: { blog_id: blogId, route, params },
    });

    if (error) {
      console.error("[useContentApi] Edge function error (by blog_id):", error);
      return null;
    }

    return data as ContentApiResponse<T>;
  } catch (err) {
    console.error("[useContentApi] Fetch error (by blog_id):", err);
    return null;
  }
}

/**
 * Fetch content-api with blog_slug (bypasses hostname resolution)
 * Useful for routes like /blog/:blogSlug/:articleSlug
 */
export async function fetchContentApiByBlogSlug<T>(
  route: ContentRoute,
  blogSlug: string,
  params: Record<string, unknown> = {}
): Promise<ContentApiResponse<T> | null> {
  try {
    const { data, error } = await supabase.functions.invoke("content-api", {
      body: { blog_slug: blogSlug, route, params },
    });

    if (error) {
      console.error("[useContentApi] Edge function error (by blog_slug):", error);
      return null;
    }

    return data as ContentApiResponse<T>;
  } catch (err) {
    console.error("[useContentApi] Fetch error (by blog_slug):", err);
    return null;
  }
}

// ============================================================
// HOOK: useBlogHome - Fetch blog home with articles
// ============================================================

interface BlogHomeData {
  articles: ArticleSummary[];
  total: number;
  limit: number;
  offset: number;
}

interface UseBlogHomeResult {
  blog: BlogMeta | null;
  articles: ArticleSummary[];
  total: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseBlogHomeOptions {
  blogId?: string;   // If provided, bypasses hostname resolution
  blogSlug?: string; // If provided, resolves by blog slug
  limit?: number;    // Default: 12
  offset?: number;   // Default: 0
}

export function useBlogHome(options: UseBlogHomeOptions = {}): UseBlogHomeResult {
  const { blogId, blogSlug, limit = 12, offset = 0 } = options;
  const [blog, setBlog] = useState<BlogMeta | null>(null);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Priority: blogId > blogSlug > hostname
    let result: ContentApiResponse<BlogHomeData> | null = null;
    
    if (blogId) {
      result = await fetchContentApiByBlogId<BlogHomeData>("blog.home", blogId, { limit, offset });
    } else if (blogSlug) {
      result = await fetchContentApiByBlogSlug<BlogHomeData>("blog.home", blogSlug, { limit, offset });
    } else {
      result = await fetchContentApi<BlogHomeData>("blog.home", { limit, offset });
    }

    if (!result) {
      setError("Falha ao carregar blog");
      setLoading(false);
      return;
    }

    setBlog(result.blog);
    setArticles(result.data.articles || []);
    setTotal(result.data.total || 0);
    setLoading(false);
  }, [blogId, blogSlug, limit, offset]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { blog, articles, total, loading, error, refetch: fetch };
}

// ============================================================
// HOOK: useBlogArticle - Fetch single article
// ============================================================

interface BlogArticleData {
  article: ArticleFull | null;
  related: ArticleSummary[];
  error?: string;
}

interface UseBlogArticleResult {
  blog: BlogMeta | null;
  article: ArticleFull | null;
  related: ArticleSummary[];
  loading: boolean;
  error: string | null;
}

interface UseBlogArticleOptions {
  blogId?: string;   // If provided, bypasses hostname resolution
  blogSlug?: string; // If provided, resolves by blog slug
}

export function useBlogArticle(
  slug: string | undefined, 
  options?: UseBlogArticleOptions
): UseBlogArticleResult {
  const [blog, setBlog] = useState<BlogMeta | null>(null);
  const [article, setArticle] = useState<ArticleFull | null>(null);
  const [related, setRelated] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError("Slug não fornecido");
      return;
    }

    const fetch = async () => {
      setLoading(true);
      setError(null);

      // Priority: blogId > blogSlug > hostname
      let result: ContentApiResponse<BlogArticleData> | null = null;
      
      if (options?.blogId) {
        result = await fetchContentApiByBlogId<BlogArticleData>("blog.article", options.blogId, { slug });
      } else if (options?.blogSlug) {
        result = await fetchContentApiByBlogSlug<BlogArticleData>("blog.article", options.blogSlug, { slug });
      } else {
        result = await fetchContentApi<BlogArticleData>("blog.article", { slug });
      }

      if (!result) {
        setError("Falha ao carregar artigo");
        setLoading(false);
        return;
      }

      if (result.data.error) {
        setError(result.data.error);
        setLoading(false);
        return;
      }

      setBlog(result.blog);
      setArticle(result.data.article);
      setRelated(result.data.related || []);
      setLoading(false);
    };

    fetch();
  }, [slug, options?.blogId, options?.blogSlug]);

  return { blog, article, related, loading, error };
}

// ============================================================
// HOOK: useLandingPage - Fetch landing page
// ============================================================

interface LandingPageData {
  page: LandingPage | null;
  error?: string;
}

interface UseLandingPageResult {
  blog: BlogMeta | null;
  page: LandingPage | null;
  loading: boolean;
  error: string | null;
}

interface UseLandingPageOptions {
  blogId?: string;   // If provided, bypasses hostname resolution
  blogSlug?: string; // If provided, resolves by blog slug
}

export function useLandingPage(
  slug: string | undefined,
  options?: UseLandingPageOptions
): UseLandingPageResult {
  const [blog, setBlog] = useState<BlogMeta | null>(null);
  const [page, setPage] = useState<LandingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      setError("Slug não fornecido");
      return;
    }

    const fetch = async () => {
      setLoading(true);
      setError(null);

      // Priority: blogId > blogSlug > hostname
      let result: ContentApiResponse<LandingPageData> | null = null;
      
      if (options?.blogId) {
        result = await fetchContentApiByBlogId<LandingPageData>("page.landing", options.blogId, { slug });
      } else if (options?.blogSlug) {
        result = await fetchContentApiByBlogSlug<LandingPageData>("page.landing", options.blogSlug, { slug });
      } else {
        result = await fetchContentApi<LandingPageData>("page.landing", { slug });
      }

      if (!result) {
        setError("Falha ao carregar página");
        setLoading(false);
        return;
      }

      if (result.data.error) {
        setError(result.data.error);
        setLoading(false);
        return;
      }

      setBlog(result.blog);
      setPage(result.data.page);
      setLoading(false);
    };

    fetch();
  }, [slug, options?.blogId, options?.blogSlug]);

  return { blog, page, loading, error };
}

// ============================================================
// HOOK: useAgentConfig - Fetch agent configuration
// ============================================================

interface AgentConfigData {
  agent: AgentConfig | null;
  business: BusinessProfile | null;
}

interface UseAgentConfigResult {
  agentConfig: AgentConfig | null;
  businessProfile: BusinessProfile | null;
  loading: boolean;
}

export function useAgentConfig(options?: { blogId?: string; blogSlug?: string }): UseAgentConfigResult {
  const [agentConfig, setAgentConfig] = useState<AgentConfig | null>(null);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const blogId = options?.blogId;
  const blogSlug = options?.blogSlug;

  useEffect(() => {
    const fetch = async () => {
      let result: ContentApiResponse<AgentConfigData> | null = null;

      if (blogId) {
        result = await fetchContentApiByBlogId<AgentConfigData>("agent.config", blogId);
      } else if (blogSlug) {
        result = await fetchContentApiByBlogSlug<AgentConfigData>("agent.config", blogSlug);
      } else {
        result = await fetchContentApi<AgentConfigData>("agent.config");
      }

      if (result) {
        setAgentConfig(result.data.agent);
        setBusinessProfile(result.data.business);
      }

      setLoading(false);
    };

    fetch();
  }, [blogId, blogSlug]);

  return { agentConfig, businessProfile, loading };
}
