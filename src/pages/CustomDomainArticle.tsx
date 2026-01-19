import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isBlogDomainAccess, getCurrentHostname, getCanonicalArticleUrl } from "@/utils/blogUrl";
import { Loader2 } from "lucide-react";

// Import components from PublicArticle
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
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ChevronDown } from "lucide-react";

interface Blog {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  logo_negative_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  author_name: string | null;
  author_bio: string | null;
  author_photo_url: string | null;
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
  keywords: string[] | null;
  meta_description: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  published_at: string | null;
  reading_time: number | null;
  faq: { question: string; answer: string }[] | null;
  content_images: ContentImage[] | null;
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

interface Translation {
  language_code: string;
  title: string;
  content: string | null;
  excerpt: string | null;
  meta_description: string | null;
  faq: { question: string; answer: string }[] | null;
}

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
  
  const [blog, setBlog] = useState<Blog | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [relatedArticles, setRelatedArticles] = useState<RelatedArticle[]>([]);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Brand Sales Agent
  const { agentConfig, businessProfile } = useBrandAgentConfig(blog?.id || null);

  useEffect(() => {
    const fetchData = async () => {
      console.log('[CustomDomainArticle] Fetching data...', { blogId, propBlogSlug, articleSlug });
      
      // If no article slug, redirect to blog home
      if (!articleSlug || articleSlug === "") {
        navigate("/", { replace: true });
        return;
      }

      let blogData: Blog | null = null;
      
      // If we have blogId from routing, use it directly
      if (blogId) {
        const { data, error: fetchError } = await supabase
          .from("blogs")
          .select("*")
          .eq("id", blogId)
          .maybeSingle();
        
        if (fetchError) {
          console.error('[CustomDomainArticle] Error fetching by ID:', fetchError);
        } else {
          blogData = data;
        }
      }
      
      // Fallback: try to find by hostname
      if (!blogData) {
        const hostname = getCurrentHostname();
        console.log('[CustomDomainArticle] Trying hostname lookup:', hostname);
        
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
            console.error('[CustomDomainArticle] Error fetching by subdomain:', fetchError);
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
            console.error('[CustomDomainArticle] Error fetching by custom domain:', fetchError);
          } else {
            blogData = data;
          }
        }
      }

      if (!blogData) {
        console.log('[CustomDomainArticle] No blog found');
        setError("Blog não encontrado");
        setLoading(false);
        return;
      }

      console.log('[CustomDomainArticle] Blog found:', blogData.id);
      setBlog(blogData);

      // Fetch article by slug and blog_id
      const { data: articleData, error: articleError } = await supabase
        .from("articles")
        .select("*")
        .eq("blog_id", blogData.id)
        .eq("slug", articleSlug)
        .eq("status", "published")
        .maybeSingle();

      if (articleError || !articleData) {
        console.log('[CustomDomainArticle] Article not found');
        setError("Artigo não encontrado");
        setLoading(false);
        return;
      }

      console.log('[CustomDomainArticle] Article found:', articleData.id);

      // Parse content_images and faq
      const parsedArticle = {
        ...articleData,
        content_images: typeof articleData.content_images === 'string' 
          ? JSON.parse(articleData.content_images) 
          : articleData.content_images,
        faq: typeof articleData.faq === 'string' 
          ? JSON.parse(articleData.faq) 
          : articleData.faq
      } as Article;

      setArticle(parsedArticle);

      // Increment view count
      await supabase.rpc("increment_view_count", { article_id: articleData.id });

      // Fetch translations
      const { data: translationData } = await supabase
        .from("article_translations")
        .select("*")
        .eq("article_id", articleData.id);

      if (translationData) {
        setTranslations(translationData.map(t => ({
          ...t,
          faq: typeof t.faq === 'string' ? JSON.parse(t.faq) : t.faq
        })));
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

      setLoading(false);
    };

    fetchData();
  }, [articleSlug, navigate, blogId, propBlogSlug]);

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

  // Get content based on selected language
  const selectedTranslation = selectedLanguage 
    ? translations.find(t => t.language_code === selectedLanguage) 
    : null;
  
  const displayTitle = selectedTranslation?.title || article.title;
  const displayContent = selectedTranslation?.content || article.content;
  const displayExcerpt = selectedTranslation?.excerpt || article.excerpt;
  const displayMetaDescription = selectedTranslation?.meta_description || article.meta_description;
  
  // Parse FAQ from translation (pode vir como string JSON)
  const displayFaq = (() => {
    if (selectedTranslation?.faq) {
      return typeof selectedTranslation.faq === 'string' 
        ? JSON.parse(selectedTranslation.faq) 
        : selectedTranslation.faq;
    }
    return article.faq;
  })();

  const readingTime = calculateReadingTime(displayContent);
  const canonicalUrl = getCanonicalArticleUrl(blog, article.slug);
  const primaryColor = blog.primary_color || "#6366f1";
  
  // State for focused reading mode
  const [isFocusedMode, setIsFocusedMode] = useState(false);

  // Get available language codes for language selector
  const availableLanguages = translations.map(t => t.language_code);
  const currentLanguage = selectedLanguage || 'pt-BR';


  return (
    <>
      <SEOHead
        title={displayTitle}
        description={displayMetaDescription || displayExcerpt || ""}
        ogImage={article.featured_image_url || undefined}
        ogType="article"
        canonicalUrl={canonicalUrl}
        articlePublishedTime={article.published_at || undefined}
        articleAuthor={blog.author_name || undefined}
        keywords={article.keywords || undefined}
        faq={displayFaq || undefined}
        favicon={blog.favicon_url || undefined}
      />


      <ReadingTracker articleId={article.id} blogId={blog.id} />

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

        <FloatingShareBar
          url={canonicalUrl}
          title={displayTitle}
          description={displayMetaDescription || displayExcerpt || ""}
          articleId={article.id}
          blogId={blog.id}
          primaryColor={primaryColor}
        />

        <main className="flex-1">
          {/* Hero Section */}
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
              {displayTitle}
            </h1>

            {/* Excerpt */}
            {displayExcerpt && (
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                {displayExcerpt}
              </p>
            )}

            {/* Language Selector */}
            {translations.length > 0 && (
              <div className="mb-8">
                <ArticleLanguageSelector
                  currentLanguage={currentLanguage}
                  availableLanguages={availableLanguages}
                  onLanguageChange={(lang) => setSelectedLanguage(lang === 'pt-BR' ? null : lang)}
                  primaryColor={primaryColor}
                />
              </div>
            )}


            {/* Featured Image */}
            {article.featured_image_url && (
              <div className="mb-10 rounded-xl overflow-hidden shadow-lg">
                <img
                  src={article.featured_image_url}
                  alt={article.featured_image_alt || displayTitle}
                  className="w-full h-auto object-cover"
                  loading="eager"
                />
              </div>
            )}

            {/* Table of Contents */}
            {displayContent && (
              <TableOfContents content={displayContent} primaryColor={primaryColor} />
            )}

            {/* Article Content */}
            <div className="prose prose-lg dark:prose-invert max-w-none">
              <ArticleContent 
                content={displayContent || ""} 
                contentImages={article.content_images}
              />
            </div>

            {/* FAQ Section */}
            {displayFaq && displayFaq.length > 0 && (
              <section className="mt-12 pt-8 border-t border-border/50">
                <h2 className="font-heading text-2xl font-bold text-foreground mb-6">
                  Perguntas Frequentes
                </h2>
                <div className="bg-muted/30 rounded-xl p-6">
                  {displayFaq.map((item, index) => (
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
            {blog.cta_text && blog.cta_url && (
              <CTABanner
                title={blog.banner_title}
                description={blog.banner_description}
                ctaText={blog.cta_text}
                ctaUrl={blog.cta_url}
                ctaType={blog.cta_type}
                primaryColor={primaryColor}
              />
            )}


            {/* Related Articles */}
            <RelatedArticles 
              articles={relatedArticles} 
              blogSlug={blog.slug}
              primaryColor={primaryColor}
              customDomain={blog.custom_domain}
              domainVerified={blog.domain_verified}
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
        {blog && article && agentConfig && agentConfig.is_enabled && (
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

