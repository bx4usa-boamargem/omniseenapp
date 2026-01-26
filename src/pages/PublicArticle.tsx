import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
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
import { useBrandAgentConfig } from "@/hooks/useBrandAgentConfig";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocaleFormat } from "@/hooks/useLocaleFormat";
import { usePublicArticleTranslation } from "@/hooks/useArticleTranslations";
import { getCanonicalArticleUrl, getBlogPath } from "@/utils/blogUrl";
import { Calendar, Clock, ChevronDown, ChevronUp, Eye, Share2, ArrowLeft } from "lucide-react";
import { ArticlePdfDownload } from "@/components/articles/ArticlePdfDownload";

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
  author_name: string | null;
  author_photo_url: string | null;
  author_bio: string | null;
  author_linkedin: string | null;
  banner_title: string | null;
  banner_description: string | null;
  cta_text: string | null;
  cta_url: string | null;
  cta_type: string | null;
  custom_domain: string | null;
  domain_verified: boolean | null;
  brand_display_mode: string | null;
  platform_subdomain: string | null;
}


interface ContentImage {
  context: string;
  url: string;
  after_section: number;
}

interface Article {
  id: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  slug: string;
  category: string | null;
  published_at: string | null;
  featured_image_url: string | null;
  content_images: ContentImage[] | null;
  meta_description: string | null;
  keywords: string[] | null;
  faq: { question: string; answer: string }[] | null;
  view_count: number | null;
  share_count: number | null;
  // Territorial data
  territory_id: string | null;
}

interface TerritoryInfo {
  official_name: string | null;
  neighborhood_tags: string[] | null;
  lat: number | null;
  lng: number | null;
}

interface RelatedArticle {
  id: string;
  title: string;
  excerpt: string | null;
  slug: string;
  category: string | null;
  published_at: string | null;
  featured_image_url: string | null;
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
  const { t, i18n } = useTranslation();
  const { formatDateLong, formatNumber } = useLocaleFormat();
  const { blogSlug, articleSlug } = useParams<{ blogSlug: string; articleSlug: string }>();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([]);
  const [territoryInfo, setTerritoryInfo] = useState<TerritoryInfo | null>(null);
  const [availableTranslations, setAvailableTranslations] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('pt-BR');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  
  // Brand Sales Agent
  const { agentConfig, businessProfile } = useBrandAgentConfig(blog?.id || null);
  
  // Fetch translation if a non-original language is selected
  const { data: translation, isLoading: isLoadingTranslation } = usePublicArticleTranslation(
    article?.id,
    selectedLanguage
  );
  
  // Compute displayed content (original or translated)
  const hasTranslation = selectedLanguage !== 'pt-BR' && translation !== null && translation !== undefined;
  const displayedTitle = hasTranslation && translation.title ? translation.title : article?.title;
  const displayedExcerpt = hasTranslation && translation.excerpt ? translation.excerpt : article?.excerpt;
  const displayedContent = hasTranslation && translation.content ? translation.content : article?.content;
  const displayedMetaDescription = hasTranslation && translation.meta_description ? translation.meta_description : article?.meta_description;
  
  // Parse FAQ from translation (pode vir como string JSON)
  const displayedFaq = (() => {
    if (hasTranslation && translation.faq) {
      return typeof translation.faq === 'string' 
        ? JSON.parse(translation.faq) 
        : translation.faq;
    }
    return article?.faq;
  })();

  useEffect(() => {
    const fetchData = async () => {
      if (!blogSlug || !articleSlug) return;

      try {
        // Fetch blog
        const { data: blogData, error: blogError } = await supabase
          .from("blogs")
          .select("*")
          .eq("slug", blogSlug)
          .single();

        if (blogError || !blogData) {
          setError(t('blog.notFound'));
          setLoading(false);
          return;
        }

        setBlog(blogData);

        // Fetch article
        const { data: articleData, error: articleError } = await supabase
          .from("articles")
          .select("*")
          .eq("blog_id", blogData.id)
          .eq("slug", articleSlug)
          .eq("status", "published")
          .single();

        if (articleError || !articleData) {
          setError(t('blog.articleNotFound'));
          setLoading(false);
          return;
        }

        // Parse FAQ and content_images if they're strings
        let parsedFaq: { question: string; answer: string }[] | null = null;
        let parsedContentImages: ContentImage[] | null = null;

        if (articleData.faq) {
          parsedFaq = typeof articleData.faq === 'string' 
            ? JSON.parse(articleData.faq) 
            : (Array.isArray(articleData.faq) ? articleData.faq as { question: string; answer: string }[] : null);
        }

        if (articleData.content_images) {
          parsedContentImages = typeof articleData.content_images === 'string'
            ? JSON.parse(articleData.content_images)
            : (Array.isArray(articleData.content_images) ? articleData.content_images as unknown as ContentImage[] : null);
        }

        const parsedArticle: Article = {
          ...articleData,
          faq: parsedFaq,
          content_images: parsedContentImages
        };

        setArticle(parsedArticle);

        // Fetch available translations for this article
        const { data: translationsData } = await supabase
          .from("article_translations")
          .select("language_code")
          .eq("article_id", articleData.id);

        if (translationsData) {
          setAvailableTranslations(translationsData.map(t => t.language_code));
        }

        // Fetch related articles
        const { data: relatedData } = await supabase
          .from("articles")
          .select("id, title, excerpt, slug, category, published_at, featured_image_url")
          .eq("blog_id", blogData.id)
          .eq("status", "published")
          .neq("id", articleData.id)
          .order("published_at", { ascending: false })
          .limit(3);

        if (relatedData) {
          setRelatedArticles(relatedData);
        }

        // Fetch territory data if article has territory_id
        if (articleData.territory_id) {
          const { data: territoryData } = await supabase
            .from("territories")
            .select("official_name, neighborhood_tags, lat, lng")
            .eq("id", articleData.territory_id)
            .maybeSingle();

          if (territoryData) {
            setTerritoryInfo(territoryData as TerritoryInfo);
          }
        }
      } catch (err) {
        console.error("Error:", err);
        setError(t('common.error'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [blogSlug, articleSlug, t]);

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

  if (error || !blog || !article) {
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
            <Link to={blog ? getBlogPath(blog) : `/blog/${blogSlug}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('blog.backToBlog')}
            </Link>
          </Button>

        </div>
      </div>
    );
  }

  const readingTime = calculateReadingTime(displayedContent);
  const canonicalUrl = getCanonicalArticleUrl(blog, article.slug);
  const blogPath = getBlogPath(blog);

  return (
    <div className="min-h-screen bg-background">
      <ReadingTracker articleId={article.id} blogId={blog.id} />
      
      <SEOHead
        title={`${displayedTitle} | ${blog.name}`}
        description={displayedMetaDescription || displayedExcerpt || ""}
        ogImage={article.featured_image_url || blog.logo_url || undefined}
        ogType="article"
        articlePublishedTime={article.published_at || undefined}
        articleAuthor={blog.author_name || undefined}
        canonicalUrl={canonicalUrl}
        keywords={article.keywords || undefined}
        faq={displayedFaq || undefined}
        favicon={blog.favicon_url || undefined}
        territorial={territoryInfo ? {
          official_name: territoryInfo.official_name,
          neighborhoods_used: territoryInfo.neighborhood_tags || [],
          geo: territoryInfo.lat && territoryInfo.lng ? {
            latitude: territoryInfo.lat,
            longitude: territoryInfo.lng
          } : null
        } : undefined}
      />

      <BlogHeader 
        blogName={blog.name} 
        blogSlug={blog.slug} 
        logoUrl={blog.logo_url}
        logoNegativeUrl={blog.logo_negative_url}
        primaryColor={blog.primary_color || undefined}
        customDomain={blog.custom_domain}
        domainVerified={blog.domain_verified}
        ctaText={blog.cta_text}
        ctaUrl={blog.cta_url}
        ctaType={blog.cta_type}
        brandDisplayMode={(blog.brand_display_mode as 'text' | 'image') || 'text'}
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
                    backgroundColor: `${blog.primary_color}15` || "hsl(var(--primary) / 0.1)",
                    color: blog.primary_color || "hsl(var(--primary))"
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
                  primaryColor={blog.primary_color || undefined}
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
              {(article.share_count || 0) > 0 && (
                <span className="flex items-center gap-1.5">
                  <Share2 className="h-4 w-4" />
                  {formatNumber(article.share_count || 0)} {t('blog.shares')}
                </span>
              )}
              
              {/* PDF Download Button */}
              <ArticlePdfDownload
                articleId={article.id}
                articleTitle={article.title}
                variant="icon"
                primaryColor={blog.primary_color || undefined}
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
              <TableOfContents content={displayedContent} primaryColor={blog.primary_color || undefined} />
            </div>
          </section>
        )}

        {/* Table of Contents - Desktop (Fixed Sidebar) */}
        {displayedContent && (
          <TableOfContents content={displayedContent} primaryColor={blog.primary_color || undefined} />
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
                  contentImages={article.content_images || []}
                />
              )}
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
                    primaryColor={blog.primary_color || undefined}
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
              title={blog.banner_title}
              description={blog.banner_description}
              ctaText={blog.cta_text}
              ctaUrl={blog.cta_url}
              ctaType={blog.cta_type}
              primaryColor={blog.primary_color || undefined}
              secondaryColor={blog.secondary_color || undefined}
            />
          </div>
        </section>

        {/* Author Box */}
        <section className="px-4 py-12 border-t border-border/50">
          <div className="max-w-3xl mx-auto lg:mr-80 lg:ml-auto">
            <AuthorBox
              name={blog.author_name}
              bio={blog.author_bio}
              photoUrl={blog.author_photo_url}
              linkedinUrl={blog.author_linkedin}
            />
          </div>
        </section>

        {/* Floating Share Bar */}
        <FloatingShareBar
          url={canonicalUrl || (typeof window !== "undefined" ? window.location.href : "")}
          title={displayedTitle || article.title}
          description={displayedExcerpt || ""}
          articleId={article.id}
          blogId={blog.id}
          primaryColor={blog.primary_color || undefined}
        />

        {/* Focused Reading Mode Button */}
        <FocusedReadingMode
          isActive={isFocusMode}
          onToggle={() => setIsFocusMode(!isFocusMode)}
          primaryColor={blog.primary_color || undefined}
        />

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <section className="px-4 py-12 border-t border-border/50 bg-muted/20">
            <div className="max-w-6xl mx-auto">
              <RelatedArticles
                articles={relatedArticles}
                blogSlug={blog.slug}
                primaryColor={blog.primary_color || undefined}
                customDomain={blog.custom_domain}
                domainVerified={blog.domain_verified}
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
              {blog.logo_url ? (
                <img src={blog.logo_url} alt={blog.name} className="h-6 w-auto" />
              ) : (
                <span className="font-heading font-semibold text-foreground">
                  {blog.name}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} {blog.name}. {t('blog.allRightsReserved')}
            </p>
          </div>
        </div>
      </footer>

      {/* Brand Sales Agent Widget */}
      {blog && agentConfig && agentConfig.is_enabled && (
        <BrandSalesAgentWidget
          blogId={blog.id}
          articleId={article.id}
          articleTitle={article.title}
          agentConfig={agentConfig}
          businessProfile={businessProfile}
          primaryColor={blog.primary_color || undefined}
        />
      )}
    </div>
  );
};

export default PublicArticle;