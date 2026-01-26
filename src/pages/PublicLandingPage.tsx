import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LandingPagePreview } from "@/components/client/landingpage/LandingPagePreview";
import { SEOHead } from "@/components/public/SEOHead";
import { BrandSalesAgentWidget } from "@/components/public/BrandSalesAgentWidget";
import { Skeleton } from "@/components/ui/skeleton";
import { getCanonicalBlogUrl } from "@/utils/blogUrl";
import { ServiceAuthorityLayout } from "@/components/client/landingpage/layouts/ServiceAuthorityLayout";

export default function PublicLandingPage() {
  const { blogSlug, pageSlug } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blog, setBlog] = useState<any>(null);
  const [page, setPage] = useState<any>(null);
  const [agentConfig, setAgentConfig] = useState<any>(null);
  const [businessProfile, setBusinessProfile] = useState<any>(null);

  const primaryColor = useMemo(() => blog?.primary_color || "#6366f1", [blog?.primary_color]);

  useEffect(() => {
    const run = async () => {
      if (!pageSlug) return;

      setLoading(true);
      setError(null);

      try {
        // ==============================
        // 1) Resolve blog + page
        // ==============================
        // A) Canonical (platform): /blog/:blogSlug/p/:pageSlug
        // B) Short URL (platform): /p/:pageSlug
        // ==============================

        let resolvedBlog: any | null = null;
        let resolvedPage: any | null = null;

        if (blogSlug) {
          // Resolve via blog slug first
          const { data: blogRow, error: blogErr } = await supabase
            .from("blogs")
            .select("id, name, primary_color, secondary_color, slug, platform_subdomain, custom_domain, domain_verified")
            .eq("slug", blogSlug)
            .maybeSingle();

          if (blogErr || !blogRow?.id) {
            setError("Blog não encontrado");
            return;
          }

          resolvedBlog = blogRow;

          const { data: pageRow } = await supabase
            .from("landing_pages")
            .select("*")
            .eq("blog_id", blogRow.id)
            .eq("slug", pageSlug)
            .eq("status", "published")
            .maybeSingle();

          resolvedPage = pageRow;
        } else {
          // Short URL: find the published page by slug, then fetch its blog
          const { data: pageRow } = await supabase
            .from("landing_pages")
            .select("*")
            .eq("slug", pageSlug)
            .eq("status", "published")
            .order("published_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!pageRow?.blog_id) {
            setError("Página não encontrada");
            return;
          }

          resolvedPage = pageRow;

          const { data: blogRow, error: blogErr } = await supabase
            .from("blogs")
            .select("id, name, primary_color, secondary_color, slug, platform_subdomain, custom_domain, domain_verified")
            .eq("id", pageRow.blog_id)
            .maybeSingle();

          if (blogErr || !blogRow?.id) {
            setError("Blog não encontrado");
            return;
          }

          resolvedBlog = blogRow;
        }

        if (!resolvedPage) {
          setError("Página não encontrada");
          return;
        }

        setBlog(resolvedBlog);

        const [agentRes, profileRes] = await Promise.all([
          supabase
            .from("brand_agent_config")
            .select("is_enabled, agent_name, agent_avatar_url, welcome_message, proactive_delay_seconds")
            .eq("blog_id", resolvedBlog.id)
            .maybeSingle(),
          supabase
            .from("business_profile")
            .select("company_name, logo_url, services, niche, city")
            .eq("blog_id", resolvedBlog.id)
            .maybeSingle(),
        ]);

        const normalizedPage = {
          ...resolvedPage,
          page_data:
            typeof resolvedPage.page_data === "string"
              ? JSON.parse(resolvedPage.page_data)
              : resolvedPage.page_data,
        };

        setPage(normalizedPage);
        setAgentConfig(agentRes.data);
        setBusinessProfile(profileRes.data);
      } catch (e) {
        setError("Erro ao carregar página");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [blogSlug, pageSlug]);

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

  if (error || !blog?.id || !page?.page_data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{error || "Não encontrado"}</p>
      </div>
    );
  }

  const canonicalBase = getCanonicalBlogUrl(blog);
  const canonicalUrl = `${canonicalBase}/p/${page.slug}`;

  return (
    <>
      <SEOHead
        title={page.seo_title || page.title}
        description={page.seo_description || undefined}
        ogImage={page.featured_image_url || page.page_data?.hero?.image_url || undefined}
        canonicalUrl={canonicalUrl}
      />

      <div className="min-h-screen bg-background">
        {page.page_data?.template === 'service_authority_v1' ? (
          <ServiceAuthorityLayout 
            pageData={page.page_data} 
            primaryColor={primaryColor} 
            isEditing={false} 
          />
        ) : (
          <LandingPagePreview pageData={page.page_data} blogId={blog.id} primaryColor={primaryColor} />
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