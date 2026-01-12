import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Monitor, Smartphone, Search, FileText, ChevronDown, FolderOpen, MessageCircle, Phone, Mail, Instagram, Globe, Link, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ContactButton } from "./sections/ContactButtonsSection";
import { getContactDisplayLabel, getContactHref } from "@/lib/contactLinks";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  featured_image_url: string | null;
  excerpt: string | null;
}

interface MiniSitePreviewProps {
  blogId: string;
  companyName: string;
  description?: string;
  logoUrl: string;
  logoNegativeUrl: string;
  logoBackgroundColor?: string | null;
  logoNegativeBackgroundColor?: string | null;
  primaryColor: string;
  secondaryColor: string;
  showSearch: boolean;
  headerCtaText: string;
  headerCtaUrl: string;
  bannerEnabled: boolean;
  bannerTitle: string;
  bannerDescription: string;
  bannerImageUrl: string;
  bannerBackgroundColor?: string | null;
  ctaText: string;
  ctaUrl: string;
  brandDescription: string;
  footerText: string;
  showCategoriesFooter: boolean;
  contactButtons: ContactButton[];
  // Brand display mode
  brandDisplayMode?: 'text' | 'image';
}

const BUTTON_ICONS: Record<string, React.ElementType> = {
  whatsapp: MessageCircle,
  phone: Phone,
  email: Mail,
  instagram: Instagram,
  website: Globe,
  link: Link,
};

export function MiniSitePreview({
  blogId,
  companyName,
  description,
  logoUrl,
  logoNegativeUrl,
  logoBackgroundColor,
  logoNegativeBackgroundColor,
  primaryColor,
  secondaryColor,
  showSearch,
  headerCtaText,
  headerCtaUrl,
  bannerEnabled,
  bannerTitle,
  bannerDescription,
  bannerImageUrl,
  bannerBackgroundColor,
  ctaText,
  ctaUrl,
  brandDescription,
  footerText,
  showCategoriesFooter,
  contactButtons,
  brandDisplayMode = 'text',
}: MiniSitePreviewProps) {
  const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  // Fetch real articles
  useEffect(() => {
    const fetchData = async () => {
      if (!blogId) return;
      
      setLoadingArticles(true);
      try {
        const [articlesRes, categoriesRes] = await Promise.all([
          supabase
            .from("articles")
            .select("id, title, slug, featured_image_url, excerpt")
            .eq("blog_id", blogId)
            .eq("status", "published")
            .order("created_at", { ascending: false })
            .limit(6),
          supabase
            .from("blog_categories")
            .select("id, name, slug")
            .eq("blog_id", blogId)
            .order("sort_order")
        ]);

        setArticles(articlesRes.data || []);
        setCategories(categoriesRes.data || []);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoadingArticles(false);
      }
    };

    fetchData();
  }, [blogId]);

  const displayArticles = viewMode === "desktop" ? articles.slice(0, 3) : articles.slice(0, 2);

  // Render header brand based on display mode
  const renderHeaderBrand = () => {
    if (brandDisplayMode === 'image' && logoUrl) {
      return (
        <img 
          src={logoUrl} 
          alt={companyName} 
          className="h-10 md:h-12 w-auto object-contain" 
        />
      );
    }
    return (
      <span className="font-semibold text-gray-900">
        {companyName || "Meu Blog"}
      </span>
    );
  };

  // Render footer brand based on display mode
  const renderFooterBrand = () => {
    if (brandDisplayMode === 'image') {
      const effectiveLogo = logoNegativeUrl || logoUrl;
      if (effectiveLogo) {
        return (
          <img 
            src={effectiveLogo} 
            alt={companyName} 
            className="h-8 md:h-10 w-auto object-contain" 
          />
        );
      }
    }
    return (
      <span className="font-semibold text-white">{companyName || "Meu Blog"}</span>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Preview Controls */}
      <div className="flex items-center justify-center gap-2 p-3 border-b bg-muted/30 shrink-0">
        <Button
          variant={viewMode === "desktop" ? "default" : "ghost"}
          size="sm"
          onClick={() => setViewMode("desktop")}
          className="gap-2"
        >
          <Monitor className="h-4 w-4" />
          Desktop
        </Button>
        <Button
          variant={viewMode === "mobile" ? "default" : "ghost"}
          size="sm"
          onClick={() => setViewMode("mobile")}
          className="gap-2"
        >
          <Smartphone className="h-4 w-4" />
          Celular
        </Button>
      </div>

      {/* Preview Container */}
      <div className="flex-1 overflow-auto p-4 bg-muted/50">
        <div
          className={cn(
            "bg-white rounded-xl shadow-lg overflow-hidden mx-auto transition-all duration-300 relative",
            viewMode === "desktop" ? "w-full max-w-4xl" : "w-[375px]"
          )}
          style={{ minHeight: "600px" }}
        >
          {/* Header */}
          <header
            className="border-b p-4 flex items-center justify-between"
            style={{ backgroundColor: `${primaryColor}08` }}
          >
            <div className="flex items-center gap-3">
              {renderHeaderBrand()}
            </div>

            {/* Nav Items */}
            <nav className={cn("flex items-center gap-4", viewMode === "mobile" && "hidden")}>
              <span className="text-sm text-gray-600 hover:text-gray-900 cursor-pointer">
                Início
              </span>
              
              {/* Categories Dropdown */}
              <Popover open={categoriesOpen} onOpenChange={setCategoriesOpen}>
                <PopoverTrigger asChild>
                  <button className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 transition-colors">
                    Categorias
                    <ChevronDown className={cn("h-3 w-3 transition-transform", categoriesOpen && "rotate-180")} />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  {categories.length > 0 ? (
                    <div className="space-y-1">
                      {categories.map((cat) => (
                        <div
                          key={cat.id}
                          className="px-3 py-2 text-sm rounded-md hover:bg-muted cursor-pointer transition-colors"
                        >
                          {cat.name}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <FolderOpen className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhuma categoria</p>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {/* Search */}
              {showSearch && (
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Buscar..."
                    className="h-8 w-32 pl-7 text-xs"
                    disabled
                  />
                </div>
              )}

              {headerCtaText && (
                <button
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  {headerCtaText}
                </button>
              )}
            </nav>
          </header>

          {/* Hero Section */}
          {bannerEnabled && (
            <section
              className="py-16 px-6 text-center relative overflow-hidden"
              style={{
                background: bannerImageUrl 
                  ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${bannerImageUrl}) center/cover`
                  : bannerBackgroundColor
                  ? bannerBackgroundColor
                  : `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              }}
            >
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
                {bannerTitle || companyName || "Bem-vindo"}
              </h1>
              {bannerDescription && (
                <p className="text-white/90 max-w-lg mx-auto mb-6">
                  {bannerDescription}
                </p>
              )}
              {ctaText && (
                <button className="px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors">
                  {ctaText}
                </button>
              )}
            </section>
          )}

          {/* Simple Hero if banner disabled */}
          {!bannerEnabled && (
            <section
              className="py-12 px-6 text-center"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}15, ${secondaryColor}10)`,
              }}
            >
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                {companyName || "Meu Blog"}
              </h1>
              {description && (
                <p className="text-gray-600 max-w-lg mx-auto">
                  {description}
                </p>
              )}
            </section>
          )}

          {/* Articles Grid */}
          <section className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Artigos Recentes
            </h2>

            {loadingArticles ? (
              <div className={cn("grid gap-4", viewMode === "desktop" ? "grid-cols-3" : "grid-cols-1")}>
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border rounded-lg overflow-hidden">
                    <Skeleton className="h-32 w-full" />
                    <div className="p-4">
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-3 w-full mb-1" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : articles.length > 0 ? (
              <div className={cn("grid gap-4", viewMode === "desktop" ? "grid-cols-3" : "grid-cols-1")}>
                {displayArticles.map((article) => (
                  <div key={article.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
                    {article.featured_image_url ? (
                      <img
                        src={article.featured_image_url}
                        alt={article.title}
                        className="h-32 w-full object-cover"
                      />
                    ) : (
                      <div
                        className="h-32"
                        style={{
                          background: `linear-gradient(135deg, ${primaryColor}30, ${secondaryColor}20)`,
                        }}
                      />
                    )}
                    <div className="p-4">
                      <h3 className="font-medium text-sm line-clamp-2 text-gray-900 mb-1">
                        {article.title}
                      </h3>
                      {article.excerpt && (
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {article.excerpt}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500 border-2 border-dashed rounded-lg">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nenhum artigo publicado</p>
                <p className="text-sm mt-1">Os artigos aparecerão aqui</p>
              </div>
            )}
          </section>

          {/* Pre-footer CTA Banner */}
          {ctaText && (
            <section
              className="mx-6 mb-6 p-8 rounded-xl text-center"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              }}
            >
              <h3 className="text-xl font-bold text-white mb-2">
                {bannerTitle || "Pronto para começar?"}
              </h3>
              <p className="text-white/90 mb-4 text-sm">
                {bannerDescription || "Entre em contato conosco hoje mesmo"}
              </p>
              <button className="px-6 py-2 bg-white text-gray-900 rounded-lg font-medium text-sm">
                {ctaText}
              </button>
            </section>
          )}

          {/* Footer */}
          <footer
            className="p-6"
            style={{ backgroundColor: primaryColor }}
          >
            <div className={cn("grid gap-6 mb-6", viewMode === "desktop" ? "grid-cols-3" : "grid-cols-1")}>
              {/* Brand Column */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  {renderFooterBrand()}
                </div>
                <p className="text-white/70 text-sm">
                  {brandDescription || "Seu blog pessoal com conteúdo de qualidade."}
                </p>
              </div>

              {/* Categories Column */}
              {showCategoriesFooter && categories.length > 0 && (
                <div>
                  <h4 className="font-semibold text-white mb-3">Categorias</h4>
                  <ul className="space-y-1">
                    {categories.slice(0, 5).map((cat) => (
                      <li key={cat.id}>
                        <span className="text-white/70 text-sm hover:text-white cursor-pointer">
                          {cat.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Contact Buttons Column */}
              <div>
                <h4 className="font-semibold text-white mb-3">Contato</h4>
                <div className="space-y-2">
                  {contactButtons.length > 0 ? (
                    contactButtons.map((btn, idx) => {
                      const Icon = BUTTON_ICONS[btn.button_type] || Link;
                      return (
                        <a
                          key={idx}
                          href={getContactHref(btn as any)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors cursor-pointer"
                        >
                          <Icon className="h-4 w-4" />
                          <span>{btn.label || getContactDisplayLabel(btn.button_type)}</span>
                        </a>
                      );
                    })
                  ) : (
                    <p className="text-white/50 text-sm">Nenhum contato cadastrado</p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-white/20 pt-4">
              <div className="flex flex-col md:flex-row items-center justify-between gap-2">
                <p className="text-white/50 text-xs">
                  {footerText || `© ${new Date().getFullYear()} ${companyName || "Meu Blog"}. Todos os direitos reservados.`}
                </p>
                {/* Omniseen Credit - Always visible, non-removable */}
                <p className="flex items-center gap-1 text-[13px] text-white/70">
                  Desenvolvido com <Heart className="h-3 w-3 text-purple-400 fill-purple-400" /> por{" "}
                  <a 
                    href="https://omniseen.app/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-white/80 hover:text-white font-medium transition-colors"
                  >
                    Omniseen
                  </a>
                </p>
              </div>
            </div>
          </footer>

          {/* WhatsApp Floating Button */}
          {(() => {
            const whatsappButton = contactButtons.find(btn => btn.button_type === 'whatsapp');
            if (!whatsappButton?.value) return null;
            
            return (
              <div className="absolute bottom-4 right-4 z-10 group">
                <div className="relative">
                  {/* Pulse effect */}
                  <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-30" />
                  
                  {/* Button */}
                  <a
                    href={getContactHref(whatsappButton as any)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 group-hover:scale-105"
                  >
                    <MessageCircle className="h-5 w-5" />
                    {viewMode === "desktop" && (
                      <span className="font-medium text-sm pr-1">
                        WhatsApp
                      </span>
                    )}
                  </a>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}