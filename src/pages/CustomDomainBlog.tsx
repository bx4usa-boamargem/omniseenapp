import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { isBlogDomainAccess, getCurrentHostname, getBlogUrl } from "@/utils/blogUrl";
import { SEOHead } from "@/components/public/SEOHead";
import { BlogHeader } from "@/components/public/BlogHeader";
import { ArticleCard } from "@/components/public/ArticleCard";
import { CategoryFilter } from "@/components/public/CategoryFilter";
import { BrandSalesAgentWidget } from "@/components/public/BrandSalesAgentWidget";
import { useBrandAgentConfig } from "@/hooks/useBrandAgentConfig";
import { Skeleton } from "@/components/ui/skeleton";

interface Blog {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  logo_negative_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  custom_domain: string | null;
  domain_verified: boolean | null;
  platform_subdomain: string | null;
  brand_display_mode: string | null;
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

interface CustomDomainBlogProps {
  blogId?: string | null;
  blogSlug?: string | null;
}

export default function CustomDomainBlog({ blogId, blogSlug }: CustomDomainBlogProps) {
  const [blog, setBlog] = useState<Blog | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Brand Sales Agent
  const { agentConfig, businessProfile } = useBrandAgentConfig(blog?.id || null);

  useEffect(() => {
    const fetchBlog = async () => {
      console.log('[CustomDomainBlog] Fetching blog...', { blogId, blogSlug });
      
      let blogData: Blog | null = null;
      
      // If we have blogId from routing, use it directly
      if (blogId) {
        const { data, error: fetchError } = await supabase
          .from("blogs")
          .select("*")
          .eq("id", blogId)
          .maybeSingle();
        
        if (fetchError) {
          console.error('[CustomDomainBlog] Error fetching by ID:', fetchError);
        } else {
          blogData = data;
        }
      }
      
      // Fallback: try to find by hostname
      if (!blogData) {
        const hostname = getCurrentHostname();
        console.log('[CustomDomainBlog] Trying hostname lookup:', hostname);
        
        // Check if it's a platform subdomain
        const subdomainMatch = hostname.match(/^([a-z0-9-]+)\.omniseen\.app$/i);
        if (subdomainMatch) {
          const slug = subdomainMatch[1];
          const { data, error: fetchError } = await supabase
            .from("blogs")
            .select("*")
            .or(`slug.eq.${slug},platform_subdomain.eq.${slug}`)
            .maybeSingle();
          
          if (fetchError) {
            console.error('[CustomDomainBlog] Error fetching by subdomain:', fetchError);
          } else {
            blogData = data;
          }
        } else {
          // Try custom domain
          const { data, error: fetchError } = await supabase
            .from("blogs")
            .select("*")
            .eq("custom_domain", hostname)
            .eq("domain_verified", true)
            .maybeSingle();
          
          if (fetchError) {
            console.error('[CustomDomainBlog] Error fetching by custom domain:', fetchError);
          } else {
            blogData = data;
          }
        }
      }

      if (!blogData) {
        console.log('[CustomDomainBlog] No blog found');
        setError("Blog não encontrado");
        setLoading(false);
        return;
      }

      console.log('[CustomDomainBlog] Blog found:', blogData.id);
      setBlog(blogData);

      // Fetch published articles
      const { data: articlesData } = await supabase
        .from("articles")
        .select("id, title, excerpt, slug, category, tags, published_at, featured_image_url")
        .eq("blog_id", blogData.id)
        .eq("status", "published")
        .order("published_at", { ascending: false });

      if (articlesData) {
        setArticles(articlesData);
      }

      setLoading(false);
    };

    fetchBlog();
  }, [blogId, blogSlug]);

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

  const primaryColor = blog.primary_color || "#6366f1";
  const canonicalUrl = getBlogUrl(blog);

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
          logoNegativeUrl={blog.logo_negative_url}
          primaryColor={primaryColor}
          customDomain={blog.custom_domain}
          domainVerified={blog.domain_verified}
          brandDisplayMode={(blog.brand_display_mode as 'text' | 'image') || 'text'}
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
        {blog && agentConfig && agentConfig.is_enabled && (
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
