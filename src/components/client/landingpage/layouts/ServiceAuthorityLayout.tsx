import { LandingPageData, BlockVisibility, DEFAULT_BLOCK_VISIBILITY } from "../types/landingPageTypes";
import { AuthorityHero } from "./AuthorityHero";
import { CallNowStrip } from "./CallNowStrip";
import { ServiceCardGrid } from "./ServiceCardGrid";
import { EmergencyCTA } from "./EmergencyCTA";
import { AuthorityContentBlock } from "./AuthorityContentBlock";
import { FAQSection } from "./FAQSection";
import { FooterCTA } from "./FooterCTA";
import { ArticleContent } from "@/components/public/ArticleContent";

interface ServiceAuthorityLayoutProps {
  pageData: any;
  primaryColor: string;
  visibility: BlockVisibility;
  isEditing?: boolean;
  onEditBlock?: (blockType: string, data: any) => void;
}

export function ServiceAuthorityLayout({
  pageData,
  primaryColor,
  visibility,
  isEditing = false,
  onEditBlock,
}: ServiceAuthorityLayoutProps) {
  console.log("[ServiceAuthorityLayout] Rendering with visibility:", visibility);

  const hero = pageData.hero || {};
  const services = pageData.services || [];
  const emergency = pageData.emergency || {};
  const authorityContent = pageData.authority_content || "";
  const brand = pageData.brand || {};

  // Use provided visibility or fallback to defaults
  const v = visibility || DEFAULT_BLOCK_VISIBILITY;

  return (
    <div className="w-full bg-white text-slate-900 font-sans selection:bg-blue-100 border border-slate-200">
      {/* Template Badge */}
      <div className="bg-slate-900 text-white text-[10px] px-2 py-1 uppercase tracking-widest font-bold">
        Service Authority Template v1.0
      </div>

      {/* 1. Authority Hero - respects visibility.hero */}
      {v.hero && hero && Object.keys(hero).length > 0 && (
        <AuthorityHero 
          data={{...hero, phone: brand.phone}} 
          primaryColor={primaryColor} 
          isEditing={isEditing}
          onEdit={(field, value) => onEditBlock?.('hero', { field, value })}
        />
      )}

      {/* 2. Call Now Strip - always visible if phone exists (utility component) */}
      {brand.phone && (
        <CallNowStrip 
          phone={brand.phone} 
          primaryColor={primaryColor} 
        />
      )}

      {/* 3. Service Card Grid - respects visibility.services */}
      {v.services && services.length > 0 && (
        <ServiceCardGrid 
          services={services} 
          primaryColor={primaryColor}
          isEditing={isEditing}
          onEdit={(index, field, value) => onEditBlock?.('services', { index, field, value })}
        />
      )}

      {/* 4. Emergency CTA - respects visibility.emergency_banner */}
      {v.emergency_banner && emergency && Object.keys(emergency).length > 0 && (
        <EmergencyCTA 
          data={emergency} 
          phone={brand.phone}
          isEditing={isEditing}
          onEdit={(field, value) => onEditBlock?.('emergency', { field, value })}
        />
      )}

      {/* 5. Authority Content Block - respects visibility.service_details (SEO content) */}
      {v.service_details && authorityContent && (
        <section className="py-24 px-6 bg-slate-50 border-y border-slate-200">
          <div className="container max-w-4xl mx-auto">
            <div className="prose prose-slate prose-lg max-w-none 
              prose-headings:font-black prose-headings:tracking-tight prose-headings:text-slate-950
              prose-h2:text-4xl prose-h2:border-b-4 prose-h2:pb-4 prose-h2:mb-8
              prose-p:text-slate-700 prose-p:leading-relaxed">
              <ArticleContent content={typeof authorityContent === 'string' ? authorityContent : (authorityContent.html || "")} />
            </div>
          </div>
        </section>
      )}

      {/* 6. FAQ Section - respects visibility.faq */}
      {v.faq && pageData.faq && pageData.faq.length > 0 && (
        <FAQSection 
          faqs={pageData.faq} 
          primaryColor={primaryColor}
        />
      )}

      {/* 7. Footer CTA - respects visibility.cta_banner */}
      {v.cta_banner && (brand.company_name || brand.phone) && (
        <FooterCTA 
          brandName={brand.company_name} 
          phone={brand.phone}
          primaryColor={primaryColor}
        />
      )}
    </div>
  );
}