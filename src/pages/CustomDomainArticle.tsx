import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useBlogArticle, useAgentConfig } from "@/hooks/useContentApi";
import { getCanonicalArticleUrl } from "@/utils/blogUrl";
import { Loader2, Calendar, Clock, ChevronDown } from "lucide-react";

import { SEOHead } from "@/components/public/SEOHead";
import { BlogHeader } from "@/components/public/BlogHeader";
import { ArticleContent } from "@/components/public/ArticleContent";
import { AuthorBox } from "@/components/public/AuthorBox";
import { CTABanner } from "@/components/public/CTABanner";
import { RelatedArticles } from "@/components/public/RelatedArticles";
import { ReadingTracker } from "@/components/public/ReadingTracker";
import { FloatingShareBar } from "@/components/public/FloatingShareBar";
import { TableOfContents } from "@/components/public/TableOfContents";
import { FocusedReadingMode } from "@/components/public/FocusedReadingMode";
import { BrandSalesAgentWidget } from "@/components/public/BrandSalesAgentWidget";
import { ArticleCTARenderer } from "@/components/client/ArticleCTARenderer";
import { Badge } from "@/components/ui/badge";

// FAQ Item component
const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-4 flex justify-between items-center text-left hover:text-primary transition-colors"
      >
        <span className="font-medium text-foreground pr-4">{question}</span>
        <ChevronDown className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="pb-4 text-muted-foreground leading-relaxed">
          {answer}
        </div>
      )}
    </div>
  );
};

const calculateReadingTime = (content: string | null): number => {
  if (!content) return 5;
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
};

interface CustomDomainArticleProps {
  blogId?: string | null;
  blogSlug?: string | null;
}

export default function CustomDomainArticle({ blogId, blogSlug: propBlogSlug }: CustomDomainArticleProps) {
  const { articleSlug } = useParams<{ articleSlug?: string }>();
  const navigate = useNavigate();
  
  // Pass blogId to bypass hostname resolution when available
  const { blog, article, related, loading, error } = useBlogArticle(articleSlug, { 
    blogId: blogId || undefined 
  });
  const { agentConfig, businessProfile } = useAgentConfig({ blogId: blogId || undefined });
  const [isFocusedMode, setIsFocusedMode] = useState(false);

  const primaryColor = useMemo(() => blog?.primary_color || "#6366f1", [blog?.primary_color]);

  // Redirect to home if no slug
  if (!articleSlug) {
    navigate("/", { replace: true });
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !blog || !article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {error || "Página não encontrada"}
          </h1>
          <p className="text-muted-foreground">
            O conteúdo que você procura não está disponível.
          </p>
        </div>
      </div>
    );
  }

  const readingTime = article.reading_time || calculateReadingTime(article.content);
  const canonicalUrl = getCanonicalArticleUrl({
    custom_domain: blog.custom_domain,
    domain_verified: true,
    platform_subdomain: blog.platform_subdomain,
    slug: blog.slug
  }, article.slug);

  // Parse FAQ if needed
  const faq = Array.isArray(article.faq) ? article.faq : null;

  return (
    <>
      <SEOHead
        title={article.title}
        description={article.meta_description || article.excerpt || ""}
        ogImage={article.featured_image_url || undefined}
        ogType="article"
        canonicalUrl={canonicalUrl}
        articlePublishedTime={article.published_at || undefined}
        articleAuthor={blog.author_name || undefined}
        keywords={article.keywords || undefined}
        faq={faq || undefined}
        favicon={blog.favicon_url || undefined}
      />

      <ReadingTracker articleId={article.id} blogId={blog.id} />

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

        <FloatingShareBar
          url={canonicalUrl}
          title={article.title}
          description={article.meta_description || article.excerpt || ""}
          articleId={article.id}
          blogId={blog.id}
          primaryColor={primaryColor}
        />

        <main className="flex-1">
          <article className="max-w-4xl mx-auto px-4 py-8">
            {/* Category & Meta */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {article.category && (
                <Badge 
                  variant="secondary"
                  style={{ 
                    backgroundColor: `${primaryColor}15`,
                    color: primaryColor 
                  }}
                >
                  {article.category}
                </Badge>
              )}
              {article.published_at && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {new Date(article.published_at).toLocaleDateString("pt-BR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  })}
                </span>
              )}
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                {readingTime} min de leitura
              </span>
            </div>

            {/* Title */}
            <h1 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
              {article.title}
            </h1>

            {/* Excerpt */}
            {article.excerpt && (
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                {article.excerpt}
              </p>
            )}

            {/* Featured Image */}
            {article.featured_image_url && (
              <div className="mb-10 rounded-xl overflow-hidden shadow-lg">
                <img
                  src={article.featured_image_url}
                  alt={article.featured_image_alt || article.title}
                  className="w-full h-auto object-cover"
                  loading="eager"
                />
              </div>
            )}

            {/* Table of Contents */}
            {article.content && (
              <TableOfContents content={article.content} primaryColor={primaryColor} />
            )}

            {/* Article Content */}
            <div className="max-w-none">
              <ArticleContent 
                content={article.content || ""} 
                contentImages={Array.isArray(article.content_images) ? (article.content_images as { context: string; url: string; after_section: number }[]) : undefined}
                hideFirstH1
              />
            </div>

            {/* Article CTA */}
            {article.cta && (
              <div className="mt-12">
                <ArticleCTARenderer cta={article.cta as any} />
              </div>
            )}

            {/* FAQ Section */}
            {faq && faq.length > 0 && (
              <section className="mt-12 pt-8 border-t border-border/50">
                <h2 className="font-heading text-2xl font-bold text-foreground mb-6">
                  Perguntas Frequentes
                </h2>
                <div className="bg-muted/30 rounded-xl p-6">
                  {faq.map((item, index) => (
                    <FAQItem key={index} question={item.question} answer={item.answer} />
                  ))}
                </div>
              </section>
            )}

            {/* Author Box */}
            {blog.author_name && (
              <AuthorBox
                name={blog.author_name}
                bio={blog.author_bio}
                photoUrl={blog.author_photo_url}
                linkedinUrl={blog.author_linkedin}
              />
            )}

            {/* CTA Banner */}
            {blog.header_cta_text && blog.header_cta_url && (
              <CTABanner
                title={blog.banner_title}
                description={blog.banner_description}
                ctaText={blog.header_cta_text}
                ctaUrl={blog.header_cta_url}
                ctaType={null}
                primaryColor={primaryColor}
              />
            )}

            {/* Related Articles */}
            <RelatedArticles 
              articles={related.map(r => ({
                id: r.id,
                title: r.title,
                excerpt: r.excerpt,
                slug: r.slug,
                category: r.category,
                published_at: r.published_at,
                featured_image_url: r.featured_image_url
              }))} 
              blogSlug={blog.slug}
              primaryColor={primaryColor}
              customDomain={blog.custom_domain}
              domainVerified={true}
            />
          </article>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/40 py-8 mt-12">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} {blog.name}. Todos os direitos reservados.
          </div>
        </footer>

        {/* Focused Reading Mode */}
        <FocusedReadingMode 
          isActive={isFocusedMode} 
          onToggle={() => setIsFocusedMode(!isFocusedMode)}
          primaryColor={primaryColor}
        />

        {/* Brand Sales Agent Widget */}
        {blog && article && agentConfig?.is_enabled && (
          <BrandSalesAgentWidget
            blogId={blog.id}
            articleId={article.id}
            articleTitle={article.title}
            agentConfig={agentConfig}
            businessProfile={businessProfile}
            primaryColor={primaryColor}
          />
        )}
      </div>
    </>
  );
}
