import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { SEOHead } from "@/components/public/SEOHead";
import { BlogHeader } from "@/components/public/BlogHeader";
import { BlogFooter } from "@/components/public/BlogFooter";
import { DynamicTrackingScripts } from "@/components/public/DynamicTrackingScripts";
import { ArticleCard } from "@/components/public/ArticleCard";
import { CategoryFilter } from "@/components/public/CategoryFilter";
import { WhatsAppFloatButton } from "@/components/public/WhatsAppFloatButton";
import { BrandSalesAgentWidget } from "@/components/public/BrandSalesAgentWidget";
import { useBlogHome, useAgentConfig } from "@/hooks/useContentApi";
import { useGlobalWhatsApp } from "@/hooks/useGlobalWhatsApp";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { getBlogUrl } from "@/utils/blogUrl";
interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ContactButton {
  id: string;
  button_type: string;
  value: string;
  label: string | null;
  sort_order: number | null;
  whatsapp_message?: string | null;
  email_subject?: string | null;
}

interface Blog {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
   favicon_url?: string | null;
  logo_negative_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  author_name: string | null;
  author_photo_url: string | null;
  author_bio: string | null;
  custom_domain: string | null;
  domain_verified: boolean | null;
  cta_type: string | null;
  cta_text: string | null;
  cta_url: string | null;
  banner_title: string | null;
  banner_description: string | null;
  banner_enabled: boolean | null;
  banner_image_url: string | null;
  brand_description: string | null;
  show_powered_by: boolean | null;
  footer_text: string | null;
  tracking_config: Record<string, unknown> | null;
  script_head: string | null;
  script_body: string | null;
  // New fields for parity with editor
  city: string | null;
  show_search: boolean | null;
  header_cta_text: string | null;
  header_cta_url: string | null;
  show_categories_footer: boolean | null;
  banner_overlay_opacity: number | null;
   platform_subdomain?: string | null;
}

interface Article {
  id: string;
  title: string;
  excerpt: string | null;
  slug: string;
  category: string | null;
  tags: string[] | null;
  published_at: string | null;
  featured_image_url: string | null;
}

const PublicBlog = () => {
  const { t } = useTranslation();
  const { blogSlug: rawBlogSlug } = useParams<{ blogSlug: string }>();
  const blogSlug = rawBlogSlug && !rawBlogSlug.startsWith(':') ? rawBlogSlug : undefined;
  const [categories, setCategories] = useState<Category[]>([]);
  const [contactButtons, setContactButtons] = useState<ContactButton[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { blog: publicBlog, articles, loading, error } = useBlogHome({ blogSlug, limit: 50 });
  
  const { agentConfig, businessProfile } = useAgentConfig({ blogSlug });
  
  // Global WhatsApp configuration (inherited from parent account)
  const { buildLink: buildWhatsAppLink } = useGlobalWhatsApp();

  const blog = useMemo<Blog | null>(() => {
    if (!publicBlog) return null;

    return {
      id: publicBlog.id,
      name: publicBlog.name,
      slug: publicBlog.slug,
      description: publicBlog.description,
      logo_url: publicBlog.logo_url,
      favicon_url: publicBlog.favicon_url,
      logo_negative_url: null,
      primary_color: publicBlog.primary_color,
      secondary_color: publicBlog.secondary_color,
      author_name: publicBlog.author_name,
      author_photo_url: publicBlog.author_photo_url,
      author_bio: publicBlog.author_bio,
      custom_domain: publicBlog.custom_domain,
      domain_verified: true,
      cta_type: null,
      cta_text: publicBlog.header_cta_text,
      cta_url: publicBlog.header_cta_url,
      banner_title: publicBlog.banner_title,
      banner_description: publicBlog.banner_description,
      banner_enabled: publicBlog.banner_enabled,
      banner_image_url: publicBlog.banner_image_url,
      brand_description: null,
      show_powered_by: publicBlog.show_powered_by,
      footer_text: publicBlog.footer_text,
      tracking_config: null,
      script_head: null,
      script_body: null,
      city: null,
      show_search: true,
      header_cta_text: publicBlog.header_cta_text,
      header_cta_url: publicBlog.header_cta_url,
      show_categories_footer: true,
      banner_overlay_opacity: 50,
      platform_subdomain: publicBlog.platform_subdomain,
    };
  }, [publicBlog]);

  useEffect(() => {
    const fetchAuxiliaryData = async () => {
      if (!blog?.id) {
        setCategories([]);
        setContactButtons([]);
        return;
      }

      try {
        const [categoriesResult, contactButtonsResult] = await Promise.all([
          supabase
            .from("blog_categories")
            .select("id, name, slug")
            .eq("blog_id", blog.id)
            .order("sort_order", { ascending: true }),
          supabase
            .from("blog_contact_buttons")
            .select("*")
            .eq("blog_id", blog.id)
            .order("sort_order", { ascending: true }),
        ]);

        if (!categoriesResult.error && categoriesResult.data) {
          setCategories(categoriesResult.data);
        } else if (categoriesResult.error) {
          console.warn("[PublicBlog] Unable to fetch categories:", categoriesResult.error.message);
        }

        if (!contactButtonsResult.error && contactButtonsResult.data) {
          setContactButtons(contactButtonsResult.data);
        } else if (contactButtonsResult.error) {
          console.warn("[PublicBlog] Unable to fetch contact buttons:", contactButtonsResult.error.message);
        }
      } catch (err) {
        console.error("[PublicBlog] Error fetching auxiliary data:", err);
      }
    };

    fetchAuxiliaryData();
  }, [blog?.id]);

  const handleCtaClick = (url?: string | null, type?: string | null) => {
    if (!url) return;
    
    if (type === "whatsapp") {
      // Use global WhatsApp template from parent account
      const whatsappUrl = buildWhatsAppLink({
        phone: url,
        companyName: blog?.name || undefined,
          service: typeof businessProfile?.services === 'string'
            ? businessProfile.services
            : businessProfile?.niche || undefined,
        city: blog?.city || businessProfile?.city || undefined,
      });
      window.open(whatsappUrl, "_blank");
    } else {
      window.open(url, "_blank");
    }
  };

  // Loading state - always light theme
  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="border-b border-gray-200 p-4 bg-white">
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="container mx-auto px-4 py-12">
          <Skeleton className="h-12 w-64 mb-4" />
          <Skeleton className="h-6 w-96 mb-12" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state - always light theme
  if (error || !blog) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-heading text-4xl font-bold text-gray-900 mb-4">
            {error || t('blog.notFound')}
          </h1>
          <p className="text-gray-600">
            {t('blog.notFoundDescription')}
          </p>
        </div>
      </div>
    );
  }

  const canonicalUrl = getBlogUrl(blog);
  const primaryColor = blog.primary_color || '#6366f1';
  const secondaryColor = blog.secondary_color || '#8b5cf6';
  
  // Find WhatsApp button for floating button
  const whatsappButton = contactButtons.find(btn => btn.button_type === 'whatsapp');

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      <DynamicTrackingScripts
        trackingConfig={blog.tracking_config as Record<string, string> | null}
        scriptHead={blog.script_head}
        scriptBody={blog.script_body}
      />

      <SEOHead
        title={`${blog.name} | Blog`}
        description={blog.description || `Leia os artigos do blog ${blog.name}`}
        ogImage={blog.logo_url || undefined}
        canonicalUrl={canonicalUrl}
        favicon={blog.favicon_url || undefined}
      />

      <BlogHeader
        blogId={blog.id}
        blogName={blog.name}
        blogSlug={blog.slug}
        logoUrl={blog.logo_url}
        logoNegativeUrl={blog.logo_negative_url}
        primaryColor={primaryColor}
        customDomain={blog.custom_domain}
        domainVerified={blog.domain_verified}
        ctaText={blog.cta_text}
        ctaUrl={blog.cta_url}
        ctaType={blog.cta_type}
        showSearch={blog.show_search ?? true}
        headerCtaText={blog.header_cta_text}
        headerCtaUrl={blog.header_cta_url}
        brandDisplayMode={((blog as any).brand_display_mode as 'text' | 'image') || 'text'}
      />

      {/* Hero Section - Two modes based on banner_enabled */}
      {blog.banner_enabled ? (
        // Hero with full gradient (banner enabled)
        (() => {
          const overlayOpacity = ((blog as any).banner_overlay_opacity ?? 50) / 100;
          return (
            <section
              className="py-12 md:py-24 px-4 relative overflow-hidden"
              style={{
                background: blog.banner_image_url 
                  ? `linear-gradient(rgba(0,0,0,${overlayOpacity}), rgba(0,0,0,${overlayOpacity})), url(${blog.banner_image_url}) center/cover`
                  : `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              }}
            >
              <div className="container mx-auto px-4 text-center relative z-10">
                <h1 className="font-heading text-2xl sm:text-3xl md:text-5xl font-bold text-white mb-3 md:mb-4 leading-tight">
                  {blog.banner_title || blog.name}
                </h1>
                {blog.banner_description && (
                  <p className="text-white/90 text-sm md:text-lg lg:text-xl max-w-2xl mx-auto mb-4 md:mb-6 leading-relaxed">
                    {blog.banner_description}
                  </p>
                )}
                {blog.cta_text && blog.cta_url && (
                  <Button
                    onClick={() => handleCtaClick(blog.cta_url, blog.cta_type)}
                    className="bg-white text-gray-900 hover:bg-gray-100 px-6 md:px-8 py-2.5 md:py-3 text-sm md:text-base"
                  >
                    {blog.cta_text}
                  </Button>
                )}
              </div>
            </section>
          );
        })()
      ) : (
        // Simple hero with light gradient (banner disabled)
        <section 
          className="py-12 md:py-16"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}10)`,
          }}
        >
          <div className="container mx-auto px-4 text-center">
            {blog.logo_url && (
              <img
                src={blog.logo_url}
                alt={blog.name}
                className="h-16 w-16 object-contain mx-auto mb-6 rounded-xl"
              />
            )}
            <h1 className="font-heading text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              {blog.name}
            </h1>
            {blog.description && (
              <p className="text-gray-600 text-lg md:text-xl max-w-2xl mx-auto">
                {blog.description}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Articles Grid - Always light theme */}
      <main className="container mx-auto px-4 py-12 flex-1 bg-gray-50">
        {articles.length === 0 ? (
          <div className="text-center py-16">
            <h2 className="font-heading text-2xl font-semibold text-gray-900 mb-2">
              {t('blog.noArticles')}
            </h2>
            <p className="text-gray-600">
              {t('blog.noArticlesDescription')}
            </p>
          </div>
        ) : (
          <>
            <h2 className="font-heading text-2xl font-bold text-gray-900 mb-6">
              {t('blog.recentArticles')}
            </h2>
            
            {/* Category Filter */}
            {(() => {
              const uniqueCategories = [...new Set(articles
                .map(a => a.category)
                .filter(Boolean)
              )] as string[];
              
              const articleCounts = articles.reduce((acc, a) => {
                if (a.category) {
                  acc[a.category] = (acc[a.category] || 0) + 1;
                }
                return acc;
              }, {} as Record<string, number>);
              
              const filteredArticles = selectedCategory
                ? articles.filter(a => a.category === selectedCategory)
                : articles;
              
              return (
                <>
                  <CategoryFilter
                    categories={uniqueCategories}
                    activeCategory={selectedCategory}
                    onCategoryChange={setSelectedCategory}
                    primaryColor={primaryColor}
                    articleCounts={articleCounts}
                  />
                  
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredArticles.map((article) => (
                      <ArticleCard
                        key={article.id}
                        title={article.title}
                        excerpt={article.excerpt}
                        slug={article.slug}
                        blogSlug={blog.slug}
                        category={article.category}
                        tags={article.tags}
                        publishedAt={article.published_at}
                        featuredImageUrl={article.featured_image_url}
                        primaryColor={primaryColor}
                        customDomain={blog.custom_domain}
                        domainVerified={blog.domain_verified}
                      />
                    ))}
                  </div>
                </>
              );
            })()}
          </>
        )}
      </main>

      {/* Pre-footer CTA Banner */}
      {blog.cta_text && blog.cta_url && (
        <section className="container mx-auto px-4 py-8">
          <div
            className="p-12 rounded-2xl text-center"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
            }}
          >
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-3">
              {blog.banner_title || "Pronto para começar?"}
            </h3>
            <p className="text-white/90 mb-6 max-w-xl mx-auto">
              {blog.banner_description || "Entre em contato conosco hoje mesmo."}
            </p>
            <Button
              onClick={() => handleCtaClick(blog.cta_url, blog.cta_type)}
              className="bg-white text-gray-900 hover:bg-gray-100 px-8 py-3"
            >
              {blog.cta_text}
            </Button>
          </div>
        </section>
      )}

      <BlogFooter
        blogName={blog.name}
        blogSlug={blog.slug}
        blogDescription={blog.description}
        brandDescription={blog.brand_description}
        logoUrl={blog.logo_url}
        logoNegativeUrl={blog.logo_negative_url}
        primaryColor={primaryColor}
        categories={categories}
        bannerTitle={blog.banner_title}
        bannerDescription={blog.banner_description}
        ctaText={blog.cta_text}
        ctaUrl={blog.cta_url}
        ctaType={blog.cta_type}
        showPoweredBy={blog.show_powered_by ?? true}
        footerText={blog.footer_text}
        customDomain={blog.custom_domain}
        domainVerified={blog.domain_verified}
        contactButtons={contactButtons}
        showCategoriesFooter={blog.show_categories_footer ?? true}
        brandDisplayMode={((blog as any).brand_display_mode as 'text' | 'image') || 'text'}
      />

      {/* WhatsApp Floating Button */}
      {whatsappButton?.value && (
        <WhatsAppFloatButton 
          phoneNumber={whatsappButton.value} 
          message={whatsappButton.whatsapp_message || undefined}
        />
      )}

      {/* Brand Sales Agent Widget */}
      {blog && agentConfig && agentConfig.is_enabled && (
        <BrandSalesAgentWidget
          blogId={blog.id}
          agentConfig={agentConfig}
          businessProfile={businessProfile}
          primaryColor={primaryColor}
        />
      )}
    </div>
  );
};

export default PublicBlog;