import { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useLandingPage, useAgentConfig, fetchLandingPageDirect, BlogMeta, LandingPage } from "@/hooks/useContentApi";
import { LandingPagePreview } from "@/components/client/landingpage/LandingPagePreview";
import { SEOHead } from "@/components/public/SEOHead";
import { BrandSalesAgentWidget } from "@/components/public/BrandSalesAgentWidget";
import { Skeleton } from "@/components/ui/skeleton";
import { getCanonicalBlogUrl } from "@/utils/blogUrl";
import { ServiceAuthorityLayout } from "@/components/client/landingpage/layouts/ServiceAuthorityLayout";
import { InstitutionalLayout } from "@/components/client/landingpage/layouts/InstitutionalLayout";
import { SpecialistAuthorityLayout } from "@/components/client/landingpage/layouts/SpecialistAuthorityLayout";
import { inferVisibilityFromPageData } from "@/components/client/landingpage/utils/pageDataNormalizer";

export default function PublicLandingPage() {
  const { blogSlug: rawBlogSlug, pageSlug } = useParams<{ blogSlug?: string; pageSlug: string }>();

  // Guard: ignore literal route param tokens like ":blogSlug"
  const blogSlug = rawBlogSlug && !rawBlogSlug.startsWith(':') ? rawBlogSlug : undefined;

  // Determine if we need direct fetch (no blogSlug means /p/:pageSlug route)
  const useDirectFetch = !blogSlug;

  // Standard hook for when we have blogSlug
  const hookResult = useLandingPage(pageSlug, { blogSlug });

  // State for direct fetch results
  const [directResult, setDirectResult] = useState<{
    blog: BlogMeta | null;
    page: LandingPage | null;
    loading: boolean;
    error: string | null;
  }>({ blog: null, page: null, loading: true, error: null });

  // Direct fetch effect
  useEffect(() => {
    if (!useDirectFetch || !pageSlug) return;

    let mounted = true;
    
    const fetchDirect = async () => {
      const result = await fetchLandingPageDirect(pageSlug);
      if (!mounted) return;
      
      setDirectResult({
        blog: result.blog,
        page: result.page,
        loading: false,
        error: result.error || null,
      });
    };

    fetchDirect();
    return () => { mounted = false; };
  }, [useDirectFetch, pageSlug]);

  // Merge results based on fetch mode
  const { blog, page, loading, error } = useDirectFetch
    ? directResult
    : hookResult;

  const { agentConfig, businessProfile } = useAgentConfig();

  const primaryColor = useMemo(() => blog?.primary_color || "#6366f1", [blog?.primary_color]);

  // Normalize page_data
  const normalizedPageData = useMemo(() => {
    if (!page?.page_data) return null;
    return typeof page.page_data === "string" 
      ? JSON.parse(page.page_data) 
      : page.page_data;
  }, [page?.page_data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-10">
          <Skeleton className="h-10 w-2/3 mb-4" />
          <Skeleton className="h-6 w-1/2 mb-10" />
          <Skeleton className="h-[60vh] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !blog?.id || !normalizedPageData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{error || "Não encontrado"}</p>
      </div>
    );
  }

  // Build canonical URL using blog metadata
  const canonicalBase = getCanonicalBlogUrl({
    custom_domain: blog.custom_domain,
    platform_subdomain: blog.platform_subdomain,
    slug: blog.slug,
  });
  const canonicalUrl = `${canonicalBase}/p/${page?.slug}`;

  const visibility = normalizedPageData?.meta?.block_visibility || inferVisibilityFromPageData(normalizedPageData);

  return (
    <>
      <SEOHead
        title={page?.seo_title || page?.title}
        description={page?.seo_description || undefined}
        ogImage={page?.featured_image_url || normalizedPageData?.hero?.image_url || undefined}
        canonicalUrl={canonicalUrl}
      />

      <div className="min-h-screen bg-background">
        {normalizedPageData?.template === 'institutional_v1' ? (
          <InstitutionalLayout 
            pageData={normalizedPageData} 
            primaryColor={primaryColor}
            visibility={visibility}
            isEditing={false} 
          />
        ) : normalizedPageData?.template === 'specialist_authority_v1' ? (
          <SpecialistAuthorityLayout 
            pageData={normalizedPageData} 
            primaryColor={primaryColor}
            visibility={visibility}
            isEditing={false} 
          />
        ) : normalizedPageData?.template === 'service_authority_v1' ? (
          <ServiceAuthorityLayout 
            pageData={normalizedPageData} 
            primaryColor={primaryColor}
            visibility={visibility}
            isEditing={false} 
          />
        ) : (
          <LandingPagePreview pageData={normalizedPageData} blogId={blog.id} primaryColor={primaryColor} />
        )}
      </div>

      {agentConfig?.is_enabled && (
        <BrandSalesAgentWidget
          blogId={blog.id}
          agentConfig={agentConfig}
          businessProfile={businessProfile}
          primaryColor={primaryColor}
        />
      )}
    </>
  );
}
