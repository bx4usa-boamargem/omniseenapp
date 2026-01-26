import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LandingPagePreview } from "@/components/client/landingpage/LandingPagePreview";
import { SEOHead } from "@/components/public/SEOHead";
import { BrandSalesAgentWidget } from "@/components/public/BrandSalesAgentWidget";

export default function CustomDomainLandingPage({ blogId }: { blogId: string }) {
  const { pageSlug } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blog, setBlog] = useState<any>(null);
  const [page, setPage] = useState<any>(null);
  const [agentConfig, setAgentConfig] = useState<any>(null);
  const [businessProfile, setBusinessProfile] = useState<any>(null);

  const primaryColor = useMemo(() => blog?.primary_color || "#6366f1", [blog?.primary_color]);

  useEffect(() => {
    const run = async () => {
      if (!blogId || !pageSlug) return;
      setLoading(true);
      setError(null);

      try {
        const { data: blogRow } = await supabase
          .from("blogs")
          .select("id, name, primary_color")
          .eq("id", blogId)
          .maybeSingle();

        setBlog(blogRow);

        const [pageRes, agentRes, profileRes] = await Promise.all([
          supabase
            .from("landing_pages")
            .select("*")
            .eq("blog_id", blogId)
            .eq("slug", pageSlug)
            .eq("status", "published")
            .maybeSingle(),
          supabase
            .from("brand_agent_config")
            .select("is_enabled, agent_name, agent_avatar_url, welcome_message, proactive_delay_seconds")
            .eq("blog_id", blogId)
            .maybeSingle(),
          supabase
            .from("business_profile")
            .select("company_name, logo_url")
            .eq("blog_id", blogId)
            .maybeSingle(),
        ]);

        if (!pageRes.data) {
          setError("Página não encontrada");
          return;
        }

        setPage(pageRes.data);
        setAgentConfig(agentRes.data);
        setBusinessProfile(profileRes.data);
      } catch (e) {
        setError("Erro ao carregar página");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [blogId, pageSlug]);

  if (loading) return null;
  if (error || !blogId || !page?.page_data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">{error || "Não encontrado"}</p>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title={page.seo_title || page.title}
        description={page.seo_description || undefined}
        ogImage={page.featured_image_url || undefined}
        canonicalUrl={undefined}
      />

      <LandingPagePreview
        pageData={page.page_data}
        blogId={blogId}
        primaryColor={primaryColor}
      />

      {agentConfig?.is_enabled && (
        <BrandSalesAgentWidget
          blogId={blogId}
          agentConfig={agentConfig}
          businessProfile={businessProfile}
          primaryColor={primaryColor}
        />
      )}
    </>
  );
}
