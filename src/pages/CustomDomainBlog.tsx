import { useState, useMemo } from "react";
import { useBlogHome, useAgentConfig } from "@/hooks/useContentApi";
import { getBlogUrl } from "@/utils/blogUrl";
import { SEOHead } from "@/components/public/SEOHead";
import { BlogHeader } from "@/components/public/BlogHeader";
import { ArticleCard } from "@/components/public/ArticleCard";
import { CategoryFilter } from "@/components/public/CategoryFilter";
import { BrandSalesAgentWidget } from "@/components/public/BrandSalesAgentWidget";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomDomainBlogProps {
  blogId?: string | null;
  blogSlug?: string | null;
}

export default function CustomDomainBlog({ blogId, blogSlug }: CustomDomainBlogProps) {
  const { blog, articles, loading, error } = useBlogHome({ blogId: blogId || undefined, limit: 50 });
  const { agentConfig, businessProfile } = useAgentConfig();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const primaryColor = useMemo(() => blog?.primary_color || "#6366f1", [blog?.primary_color]);

  // Filter articles by category
  const filteredArticles = useMemo(() => {
    if (!selectedCategory) return articles;
    return articles.filter(a => a.category === selectedCategory);
  }, [articles, selectedCategory]);

  // Get unique categories with counts
  const { categories, articleCounts } = useMemo(() => {
    const cats = [...new Set(articles.map(a => a.category).filter(Boolean))] as string[];
    const counts = articles.reduce((acc, a) => {
      if (a.category) {
        acc[a.category] = (acc[a.category] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    return { categories: cats, articleCounts: counts };
  }, [articles]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border/40 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        <div className="container mx-auto px-4 py-12">
          <Skeleton className="h-12 w-2/3 mx-auto mb-4" />
          <Skeleton className="h-6 w-1/2 mx-auto mb-12" />
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-80 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {error || "Blog não encontrado"}
          </h1>
          <p className="text-muted-foreground">
            Este domínio não está configurado corretamente.
          </p>
        </div>
      </div>
    );
  }

  const canonicalUrl = getBlogUrl({
    custom_domain: blog.custom_domain,
    domain_verified: true,
    platform_subdomain: blog.platform_subdomain,
    slug: blog.slug
  });

  return (
    <>
      <SEOHead
        title={blog.name}
        description={blog.description || `Blog ${blog.name}`}
        ogImage={blog.logo_url || undefined}
        canonicalUrl={canonicalUrl}
        favicon={blog.favicon_url || undefined}
      />

      <div className="min-h-screen bg-background flex flex-col">
        <BlogHeader 
          blogName={blog.name} 
          blogSlug={blog.slug} 
          logoUrl={blog.logo_url}
          logoNegativeUrl={null}
          primaryColor={primaryColor}
          customDomain={blog.custom_domain}
          domainVerified={true}
          brandDisplayMode="text"
        />

        <main className="flex-1">
          {/* Hero Section */}
          <section 
            className="py-16 md:py-24"
            style={{ 
              background: `linear-gradient(135deg, ${primaryColor}08 0%, ${primaryColor}03 100%)` 
            }}
          >
            <div className="container mx-auto px-4 text-center">
              <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
                {blog.name}
              </h1>
              {blog.description && (
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  {blog.description}
                </p>
              )}
            </div>
          </section>

          {/* Articles Grid */}
          <section className="py-12">
            <div className="container mx-auto px-4">
              {articles.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-muted-foreground text-lg">
                    Nenhum artigo publicado ainda.
                  </p>
                </div>
              ) : (
                <>
                  <CategoryFilter
                    categories={categories}
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
                        domainVerified={true}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/40 py-8">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} {blog.name}. Todos os direitos reservados.
          </div>
        </footer>

        {/* Brand Sales Agent Widget */}
        {blog && agentConfig?.is_enabled && (
          <BrandSalesAgentWidget
            blogId={blog.id}
            agentConfig={agentConfig}
            businessProfile={businessProfile}
            primaryColor={primaryColor}
          />
        )}
      </div>
    </>
  );
}
