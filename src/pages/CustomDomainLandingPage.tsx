import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useLandingPage, useAgentConfig } from "@/hooks/useContentApi";
import { LandingPagePreview } from "@/components/client/landingpage/LandingPagePreview";
import { ServiceAuthorityProLayout } from "@/components/client/landingpage/layouts/ServiceAuthorityProLayout";
import { ServiceAuthorityLayout } from "@/components/client/landingpage/layouts/ServiceAuthorityLayout";
import { InstitutionalLayout } from "@/components/client/landingpage/layouts/InstitutionalLayout";
import { SpecialistAuthorityLayout } from "@/components/client/landingpage/layouts/SpecialistAuthorityLayout";
import { SEOHead } from "@/components/public/SEOHead";
import { BrandSalesAgentWidget } from "@/components/public/BrandSalesAgentWidget";
import { Skeleton } from "@/components/ui/skeleton";
import { getCanonicalBlogUrl } from "@/utils/blogUrl";
import { DEFAULT_BLOCK_VISIBILITY } from "@/components/client/landingpage/types/landingPageTypes";
import { DEFAULT_PRO_VISIBILITY } from "@/components/client/landingpage/types/serviceAuthorityProTypes";

interface CustomDomainLandingPageProps {
  blogId: string;
}

export default function CustomDomainLandingPage({ blogId }: CustomDomainLandingPageProps) {
  const { pageSlug } = useParams();
  const { blog, page, loading, error } = useLandingPage(pageSlug, { blogId });
  const { agentConfig, businessProfile } = useAgentConfig();

  const primaryColor = useMemo(() => blog?.primary_color || "#6366f1", [blog?.primary_color]);

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

  if (error || !blog || !page?.page_data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{error || "Não encontrado"}</p>
      </div>
    );
  }

  const canonicalBase = getCanonicalBlogUrl({
    custom_domain: blog.custom_domain,
    domain_verified: true,
    platform_subdomain: blog.platform_subdomain,
    slug: blog.slug
  });
  const canonicalUrl = canonicalBase ? `${canonicalBase}/p/${pageSlug}` : undefined;

  // Ensure page_data is an object
  const pageData = typeof page.page_data === "string" 
    ? JSON.parse(page.page_data) 
    : page.page_data;

  const template = pageData?.template || 'service_authority_v1';

  // Render the appropriate layout based on template
  const renderLayout = () => {
    switch (template) {
      case 'service_authority_pro_v1':
        return (
          <ServiceAuthorityProLayout
            pageData={pageData}
            primaryColor={primaryColor}
            visibility={DEFAULT_PRO_VISIBILITY}
          />
        );
      case 'institutional_v1':
        return (
          <InstitutionalLayout
            pageData={pageData}
            primaryColor={primaryColor}
            visibility={DEFAULT_BLOCK_VISIBILITY}
          />
        );
      case 'specialist_authority_v1':
        return (
          <SpecialistAuthorityLayout
            pageData={pageData}
            primaryColor={primaryColor}
            visibility={DEFAULT_BLOCK_VISIBILITY}
          />
        );
      case 'service_authority_v1':
        return (
          <ServiceAuthorityLayout
            pageData={pageData}
            primaryColor={primaryColor}
            visibility={DEFAULT_BLOCK_VISIBILITY}
          />
        );
      default:
        return (
          <LandingPagePreview 
            pageData={pageData} 
            blogId={blog.id} 
            primaryColor={primaryColor} 
          />
        );
    }
  };

  return (
    <>
      <SEOHead
        title={page.seo_title || page.title}
        description={page.seo_description || undefined}
        ogImage={page.featured_image_url || (pageData as any)?.hero?.background_image_url || (pageData as any)?.hero?.image_url || undefined}
        canonicalUrl={canonicalUrl}
      />

      {/* Layout wrapper - uses ScrollArea(h-full) internally */}
      <div className="min-h-screen landing-page-pro">
        {renderLayout()}
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
