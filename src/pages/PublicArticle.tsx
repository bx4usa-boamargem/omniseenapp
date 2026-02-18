import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useBlogArticle, useAgentConfig } from "@/hooks/useContentApi";
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
import { ArticleLanguageSelector } from "@/components/public/ArticleLanguageSelector";
import { BrandSalesAgentWidget } from "@/components/public/BrandSalesAgentWidget";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocaleFormat } from "@/hooks/useLocaleFormat";
import { usePublicArticleTranslation } from "@/hooks/useArticleTranslations";
import { getCanonicalArticleUrl, getBlogPath } from "@/utils/blogUrl";
import { Calendar, Clock, ChevronDown, ChevronUp, Eye, Share2, ArrowLeft } from "lucide-react";
import { ArticlePdfDownload } from "@/components/articles/ArticlePdfDownload";
import { ArticleCTARenderer } from "@/components/client/ArticleCTARenderer";

interface ContentImage {
  context: string;
  url: string;
  after_section: number;
}

const FAQItem = ({ question, answer, primaryColor }: { question: string; answer: string; primaryColor?: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-border/50 rounded-xl overflow-hidden bg-card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
      >
        <span className="font-semibold text-foreground pr-4">{question}</span>
        <div 
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${primaryColor}15` || 'hsl(var(--primary) / 0.1)' }}
        >
          {isOpen ? (
            <ChevronUp className="h-4 w-4" style={{ color: primaryColor || 'hsl(var(--primary))' }} />
          ) : (
            <ChevronDown className="h-4 w-4" style={{ color: primaryColor || 'hsl(var(--primary))' }} />
          )}
        </div>
      </button>
      {isOpen && (
        <div className="px-5 pb-5 text-muted-foreground leading-relaxed border-t border-border/30 pt-4">
          {answer}
        </div>
      )}
    </div>
  );
};

const calculateReadingTime = (content?: string | null): number => {
  if (!content) return 3;
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
};

const PublicArticle = () => {
  const { t } = useTranslation();
  const { formatDateLong, formatNumber } = useLocaleFormat();
  const { blogSlug, articleSlug } = useParams<{ blogSlug: string; articleSlug: string }>();
  
  // Use content-api hooks with blogSlug for preview environment support
  const { blog, article, related, loading, error } = useBlogArticle(articleSlug, { blogSlug });
  const { agentConfig, businessProfile } = useAgentConfig();
  
  const [selectedLanguage, setSelectedLanguage] = useState<string>('pt-BR');
  const [isFocusMode, setIsFocusMode] = useState(false);
  
  // Fetch translation if a non-original language is selected
  const { data: translation, isLoading: isLoadingTranslation } = usePublicArticleTranslation(
    article?.id,
    selectedLanguage
  );
  
  // Parse FAQ from article (can come as JSON or array)
  const parsedFaq = useMemo(() => {
    if (!article?.faq) return null;
    return typeof article.faq === 'string' 
      ? JSON.parse(article.faq) 
      : article.faq;
  }, [article?.faq]);
  
  // Compute displayed content (original or translated)
  const hasTranslation = selectedLanguage !== 'pt-BR' && translation !== null && translation !== undefined;
  const displayedTitle = hasTranslation && translation.title ? translation.title : article?.title;
  const displayedExcerpt = hasTranslation && translation.excerpt ? translation.excerpt : article?.excerpt;
  const displayedContent = hasTranslation && translation.content ? translation.content : article?.content;
  const displayedMetaDescription = hasTranslation && translation.meta_description ? translation.meta_description : article?.meta_description;
  
  // Parse FAQ from translation (can come as JSON string)
  const displayedFaq = useMemo(() => {
    if (hasTranslation && translation?.faq) {
      return typeof translation.faq === 'string' 
        ? JSON.parse(translation.faq) 
        : translation.faq;
    }
    return parsedFaq;
  }, [hasTranslation, translation?.faq, parsedFaq]);

  // Map BlogMeta to legacy Blog interface for components
  const mappedBlog = useMemo(() => {
    if (!blog) return null;
    return {
      id: blog.id,
      name: blog.name,
      slug: blog.slug,
      description: blog.description,
      logo_url: blog.logo_url,
      logo_negative_url: null, // Not available in BlogMeta
      favicon_url: blog.favicon_url,
      primary_color: blog.primary_color,
      secondary_color: blog.secondary_color,
      author_name: blog.author_name,
      author_photo_url: blog.author_photo_url,
      author_bio: blog.author_bio,
      author_linkedin: blog.author_linkedin,
      banner_title: blog.banner_title,
      banner_description: blog.banner_description,
      cta_text: blog.header_cta_text,
      cta_url: blog.header_cta_url,
      cta_type: null, // Not available in BlogMeta
      custom_domain: blog.custom_domain,
      domain_verified: true, // Assume verified for public access
      brand_display_mode: 'text' as const,
      platform_subdomain: blog.platform_subdomain,
      footer_text: blog.footer_text,
    };
  }, [blog]);

  // Map related articles
  const mappedRelated = useMemo(() => {
    return related.map(r => ({
      id: r.id,
      title: r.title,
      excerpt: r.excerpt,
      slug: r.slug,
      category: r.category,
      published_at: r.published_at,
      featured_image_url: r.featured_image_url,
    }));
  }, [related]);

  // Available translations (we don't have this from content-api, so use empty for now)
  // TODO: Extend content-api to return available translations
  const availableTranslations: string[] = [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border/40 p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 py-12">
          <Skeleton className="h-6 w-24 mb-6" />
          <Skeleton className="h-14 w-full mb-4" />
          <Skeleton className="h-14 w-3/4 mb-8" />
          <Skeleton className="h-6 w-48 mb-10" />
          <Skeleton className="h-[400px] w-full rounded-2xl mb-10" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !mappedBlog || !article) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <h1 className="font-heading text-4xl font-bold text-foreground mb-4">
            {error || t('blog.articleNotFound')}
          </h1>
          <p className="text-muted-foreground mb-6">
            {t('blog.articleNotFoundDescription')}
          </p>
          <Button asChild>
            <Link to={mappedBlog ? getBlogPath(mappedBlog) : `/`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('blog.backToBlog')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const readingTime = calculateReadingTime(displayedContent);
  const canonicalUrl = getCanonicalArticleUrl(mappedBlog, article.slug);
  const blogPath = getBlogPath(mappedBlog);

  // Parse content_images from article data
  const contentImages: ContentImage[] = Array.isArray(article.content_images)
    ? (article.content_images as ContentImage[])
    : [];

  return (
    <div className="min-h-screen bg-background">
      <ReadingTracker articleId={article.id} blogId={mappedBlog.id} />
      
      <SEOHead
        title={`${displayedTitle} | ${mappedBlog.name}`}
        description={displayedMetaDescription || displayedExcerpt || ""}
        ogImage={article.featured_image_url || mappedBlog.logo_url || undefined}
        ogType="article"
        articlePublishedTime={article.published_at || undefined}
        articleAuthor={mappedBlog.author_name || undefined}
        canonicalUrl={canonicalUrl}
        keywords={article.keywords || undefined}
        faq={displayedFaq || undefined}
        favicon={mappedBlog.favicon_url || undefined}
      />

      <BlogHeader 
        blogName={mappedBlog.name} 
        blogSlug={mappedBlog.slug} 
        logoUrl={mappedBlog.logo_url}
        logoNegativeUrl={mappedBlog.logo_negative_url}
        primaryColor={mappedBlog.primary_color || undefined}
        customDomain={mappedBlog.custom_domain}
        domainVerified={mappedBlog.domain_verified}
        ctaText={mappedBlog.cta_text}
        ctaUrl={mappedBlog.cta_url}
        ctaType={mappedBlog.cta_type}
        brandDisplayMode={mappedBlog.brand_display_mode}
      />

      <main>
        {/* Article Hero Section */}
        <section className="pt-12 pb-8 px-4">
          <div className="max-w-3xl mx-auto lg:mr-80 lg:ml-auto text-center lg:text-left">
            {/* Language Selector & Category */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-6">
              {article.category && (
                <Badge 
                  variant="secondary" 
                  className="px-4 py-1.5 text-sm font-medium"
                  style={{ 
                    backgroundColor: `${mappedBlog.primary_color}15` || "hsl(var(--primary) / 0.1)",
                    color: mappedBlog.primary_color || "hsl(var(--primary))"
                  }}
                >
                  {article.category}
                </Badge>
              )}
              
              {availableTranslations.length > 0 && (
                <ArticleLanguageSelector
                  currentLanguage={selectedLanguage}
                  availableLanguages={availableTranslations}
                  onLanguageChange={setSelectedLanguage}
                  primaryColor={mappedBlog.primary_color || undefined}
                />
              )}
              
              {selectedLanguage !== 'pt-BR' && (
                <Badge variant="outline" className="text-xs">
                  {t('blog.translatedBy')}
                </Badge>
              )}
            </div>
            
            {/* Title */}
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-6 leading-tight">
              {isLoadingTranslation && selectedLanguage !== 'pt-BR' ? (
                <Skeleton className="h-12 w-full" />
              ) : (
                displayedTitle
              )}
            </h1>

            {/* Excerpt */}
            {displayedExcerpt && (
              <p className="text-muted-foreground text-lg md:text-xl leading-relaxed mb-8 max-w-2xl">
                {isLoadingTranslation && selectedLanguage !== 'pt-BR' ? (
                  <Skeleton className="h-6 w-full" />
                ) : (
                  displayedExcerpt
                )}
              </p>
            )}

            {/* Meta Info */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm text-muted-foreground">
              {article.published_at && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatDateLong(article.published_at)}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {readingTime} {t('blog.readingTime')}
              </span>
              {(article.view_count || 0) > 0 && (
                <span className="flex items-center gap-1.5">
                  <Eye className="h-4 w-4" />
                  {formatNumber(article.view_count || 0)} {t('blog.views')}
                </span>
              )}
              
              {/* PDF Download Button */}
              <ArticlePdfDownload
                articleId={article.id}
                articleTitle={article.title}
                variant="icon"
                primaryColor={mappedBlog.primary_color || undefined}
              />
            </div>
          </div>
        </section>

        {/* Featured Image - Aligned with content */}
        {article.featured_image_url && (
          <section className="px-4 pb-12">
            <div className="max-w-3xl mx-auto lg:mr-80 lg:ml-auto">
              <div className="rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src={article.featured_image_url}
                  alt={displayedTitle || article.title}
                  className="w-full aspect-video object-cover object-center"
                />
              </div>
            </div>
          </section>
        )}

        {/* Table of Contents - Mobile */}
        {displayedContent && (
          <section className="px-4 lg:hidden">
            <div className="max-w-3xl mx-auto">
              <TableOfContents content={displayedContent} primaryColor={mappedBlog.primary_color || undefined} />
            </div>
          </section>
        )}

        {/* Table of Contents - Desktop (Fixed Sidebar) */}
        {displayedContent && (
          <TableOfContents content={displayedContent} primaryColor={mappedBlog.primary_color || undefined} />
        )}

        {/* Article Content */}
        {displayedContent && (
          <section className="px-4 pb-12">
            <div className="max-w-3xl mx-auto lg:mr-80 lg:ml-auto">
              {isLoadingTranslation && selectedLanguage !== 'pt-BR' ? (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <ArticleContent 
                  content={displayedContent} 
                  contentImages={contentImages}
                />
              )}
            </div>
          </section>
        )}

        {/* Article CTA */}
        {article.cta && (
          <section className="px-4 pb-12">
            <div className="max-w-3xl mx-auto lg:mr-80 lg:ml-auto">
              <ArticleCTARenderer cta={article.cta as any} />
            </div>
          </section>
        )}

        {/* FAQ Section */}
        {displayedFaq && displayedFaq.length > 0 && (
          <section className="px-4 py-12 bg-muted/30">
            <div className="max-w-3xl mx-auto lg:mr-80 lg:ml-auto">
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-8">
                {t('blog.faq')}
              </h2>
              <div className="space-y-4">
                {displayedFaq.map((item: { question: string; answer: string }, index: number) => (
                  <FAQItem 
                    key={index} 
                    question={item.question} 
                    answer={item.answer}
                    primaryColor={mappedBlog.primary_color || undefined}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Banner */}
        <section className="px-4 py-12">
          <div className="max-w-3xl mx-auto lg:mr-80 lg:ml-auto">
            <CTABanner
              title={mappedBlog.banner_title}
              description={mappedBlog.banner_description}
              ctaText={mappedBlog.cta_text}
              ctaUrl={mappedBlog.cta_url}
              ctaType={mappedBlog.cta_type}
              primaryColor={mappedBlog.primary_color || undefined}
              secondaryColor={mappedBlog.secondary_color || undefined}
            />
          </div>
        </section>

        {/* Author Box */}
        <section className="px-4 py-12 border-t border-border/50">
          <div className="max-w-3xl mx-auto lg:mr-80 lg:ml-auto">
            <AuthorBox
              name={mappedBlog.author_name}
              bio={mappedBlog.author_bio}
              photoUrl={mappedBlog.author_photo_url}
              linkedinUrl={mappedBlog.author_linkedin}
            />
          </div>
        </section>

        {/* Floating Share Bar */}
        <FloatingShareBar
          url={canonicalUrl || (typeof window !== "undefined" ? window.location.href : "")}
          title={displayedTitle || article.title}
          description={displayedExcerpt || ""}
          articleId={article.id}
          blogId={mappedBlog.id}
          primaryColor={mappedBlog.primary_color || undefined}
        />

        {/* Focused Reading Mode Button */}
        <FocusedReadingMode
          isActive={isFocusMode}
          onToggle={() => setIsFocusMode(!isFocusMode)}
          primaryColor={mappedBlog.primary_color || undefined}
        />

        {/* Related Articles */}
        {mappedRelated.length > 0 && (
          <section className="px-4 py-12 border-t border-border/50 bg-muted/20">
            <div className="max-w-6xl mx-auto">
              <RelatedArticles
                articles={mappedRelated}
                blogSlug={mappedBlog.slug}
                primaryColor={mappedBlog.primary_color || undefined}
                customDomain={mappedBlog.custom_domain}
                domainVerified={mappedBlog.domain_verified}
              />
            </div>
          </section>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8 bg-card">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {mappedBlog.logo_url ? (
                <img src={mappedBlog.logo_url} alt={mappedBlog.name} className="h-6 w-auto" />
              ) : (
                <span className="font-heading font-semibold text-foreground">
                  {mappedBlog.name}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} {mappedBlog.name}. {t('blog.allRightsReserved')}
            </p>
          </div>
        </div>
      </footer>

      {/* Brand Sales Agent Widget */}
      {mappedBlog && agentConfig && agentConfig.is_enabled && (
        <BrandSalesAgentWidget
          blogId={mappedBlog.id}
          articleId={article.id}
          articleTitle={article.title}
          agentConfig={agentConfig}
          businessProfile={businessProfile}
          primaryColor={mappedBlog.primary_color || undefined}
        />
      )}
    </div>
  );
};

export default PublicArticle;
