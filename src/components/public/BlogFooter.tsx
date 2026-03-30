import { Link } from "react-router-dom";
import { sanitizeHTML } from "@/lib/sanitize";
import { useTranslation } from "react-i18next";
import { getBlogPath } from "@/utils/blogUrl";
import { Button } from "@/components/ui/button";
import { Heart, Phone, Mail, Globe, MessageCircle, Instagram, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { getContactHref, getContactDisplayLabel } from "@/lib/contactLinks";
import { useGlobalWhatsApp } from "@/hooks/useGlobalWhatsApp";

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
  whatsapp_message?: string | null;
  email_subject?: string | null;
}

interface BlogFooterProps {
  blogName: string;
  blogSlug: string;
  blogDescription?: string | null;
  brandDescription?: string | null;
  logoUrl?: string | null;
  logoNegativeUrl?: string | null;
  primaryColor?: string;
  categories: Category[];
  bannerTitle?: string | null;
  bannerDescription?: string | null;
  ctaText?: string | null;
  ctaUrl?: string | null;
  ctaType?: string | null;
  showPoweredBy?: boolean;
  footerText?: string | null;
  customDomain?: string | null;
  domainVerified?: boolean | null;
  // WhatsApp context for global template
  companyName?: string;
  service?: string;
  city?: string;
  // New props for parity with editor
  contactButtons?: ContactButton[];
  showCategoriesFooter?: boolean;
  // Brand display mode
  brandDisplayMode?: 'text' | 'image';
}

const getButtonIcon = (type: string) => {
  switch (type) {
    case 'whatsapp': return MessageCircle;
    case 'phone': return Phone;
    case 'email': return Mail;
    case 'instagram': return Instagram;
    case 'website': return Globe;
    default: return LinkIcon;
  }
};

export function BlogFooter({
  blogName,
  blogSlug,
  blogDescription,
  brandDescription,
  logoUrl,
  logoNegativeUrl,
  primaryColor,
  categories,
  bannerTitle,
  bannerDescription,
  ctaText,
  ctaUrl,
  ctaType,
  showPoweredBy = true,
  footerText,
  customDomain,
  domainVerified,
  companyName,
  service,
  city,
  contactButtons = [],
  showCategoriesFooter = true,
  brandDisplayMode = 'text',
}: BlogFooterProps) {
  const { t } = useTranslation();
  const blogPath = getBlogPath({ slug: blogSlug, custom_domain: customDomain, domain_verified: domainVerified });
  const { buildLink } = useGlobalWhatsApp();

  const handleCtaClick = () => {
    if (!ctaUrl) return;
    
    if (ctaType === "whatsapp") {
      // Use global WhatsApp template
      const whatsappLink = buildLink({
        phone: ctaUrl,
        companyName: companyName || blogName,
        service: service || 'nossos serviços',
        city: city || '',
        articleTitle: 'o blog'
      });
      window.open(whatsappLink, "_blank");
    } else {
      window.open(ctaUrl, "_blank");
    }
  };

  const getCategoryUrl = (categorySlug: string) => {
    return `${blogPath}?categoria=${categorySlug}`;
  };

  // Filter out non-whatsapp contact buttons for footer display
  const footerContactButtons = contactButtons.filter(btn => btn.button_type !== 'whatsapp');

  // Render brand based on display mode
  const renderFooterBrand = () => {
    // Mode IMAGE: try logo_negative first (for dark background), fallback to logo_url
    if (brandDisplayMode === 'image') {
      const effectiveLogo = logoNegativeUrl || logoUrl;
      if (effectiveLogo) {
        return (
          <img 
            src={effectiveLogo} 
            alt={blogName} 
            className="h-12 md:h-14 w-auto object-contain"
          />
        );
      }
    }
    
    // Mode TEXT or fallback: show text only
    return (
      <span className="font-heading font-bold text-2xl md:text-3xl text-white">
        {blogName}
      </span>
    );
  };

  return (
    <footer 
      className="py-12"
      style={{ backgroundColor: primaryColor || "#6366f1" }}
    >
      <div className="container mx-auto px-4">
        {/* Main Footer Content */}
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* Brand Column */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {renderFooterBrand()}
            </div>
            <p className="text-white/80 text-sm leading-relaxed">
              {brandDescription || blogDescription || `Bem-vindo ao ${blogName}`}
            </p>
          </div>

          {/* Categories Column - Conditional */}
          {showCategoriesFooter && categories.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-white">Categorias</h4>
              <ul className="space-y-2">
                {categories.slice(0, 6).map((category) => (
                  <li key={category.id}>
                    <Link
                      to={getCategoryUrl(category.slug)}
                      className="text-white/70 text-sm hover:text-white transition-colors"
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Contact Buttons Column */}
          {footerContactButtons.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-white">Contato</h4>
              <div className="space-y-2">
                {footerContactButtons.map((btn) => {
                  const Icon = getButtonIcon(btn.button_type);
                  return (
                    <a
                      key={btn.id}
                      href={getContactHref(btn as any)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{btn.label || getContactDisplayLabel(btn.button_type)}</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* CTA Column */}
          <div className="space-y-4">
            <h4 className="font-semibold text-white">
              {bannerTitle || "Entre em contato"}
            </h4>
            <p className="text-white/80 text-sm">
              {bannerDescription || "Fale conosco para saber mais sobre nosso conteúdo."}
            </p>
            {ctaText && ctaUrl && (
              <Button
                onClick={handleCtaClick}
                variant="secondary"
                className="bg-white text-gray-900 hover:bg-white/90"
              >
                {ctaText}
              </Button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/20 pt-6">
          {/* Custom Footer Text */}
          {footerText && (
            <div 
              className="text-white/60 text-sm text-center mb-4"
              dangerouslySetInnerHTML={{ __html: sanitizeHTML(footerText) }}
            />
          )}

          {/* Bottom Row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/60">
            <p>
              © {new Date().getFullYear()} {blogName}. {t("blog.allRightsReserved")}
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
      </div>
    </footer>
  );
}