import { LandingPageData } from "../types/landingPageTypes";
import { AuthorityHero } from "./AuthorityHero";
import { CallNowStrip } from "./CallNowStrip";
import { ServiceCardGrid } from "./ServiceCardGrid";
import { EmergencyCTA } from "./EmergencyCTA";
import { AuthorityContentBlock } from "./AuthorityContentBlock";
import { FAQSection } from "./FAQSection";
import { FooterCTA } from "./FooterCTA";
import { ArticleContent } from "@/components/public/ArticleContent";

interface ServiceAuthorityLayoutProps {
  pageData: any; // Using any temporarily to support the new schema
  primaryColor: string;
  isEditing?: boolean;
  onEditBlock?: (blockType: string, data: any) => void;
}

export function ServiceAuthorityLayout({
  pageData,
  primaryColor,
  isEditing = false,
  onEditBlock,
}: ServiceAuthorityLayoutProps) {
  // Debug log para confirmar que o layout novo está sendo montado
  console.log("[ServiceAuthorityLayout] Rendering with template:", pageData.template);

  const hero = pageData.hero || {};
  const services = pageData.services || [];
  const emergency = pageData.emergency || {};
  const authorityContent = pageData.authority_content || ""; // Agora pode ser string direta ou html
  const brand = pageData.brand || {};

  return (
    <div className="w-full bg-white text-slate-900 font-sans selection:bg-blue-100 border border-slate-200">
      {/* Marcador visual de que o layout novo está ativo */}
      <div className="bg-slate-900 text-white text-[10px] px-2 py-1 uppercase tracking-widest font-bold">
        Service Authority Template v1.0
      </div>

      {/* 1. Authority Hero */}
      <AuthorityHero 
        data={{...hero, phone: brand.phone}} 
        primaryColor={primaryColor} 
        isEditing={isEditing}
        onEdit={(field, value) => onEditBlock?.('hero', { field, value })}
      />

      {/* 2. Call Now Strip (Floating-style or fixed) */}
      <CallNowStrip 
        phone={brand.phone} 
        primaryColor={primaryColor} 
      />

      {/* 3. Service Card Grid */}
      <ServiceCardGrid 
        services={services} 
        primaryColor={primaryColor}
        isEditing={isEditing}
        onEdit={(index, field, value) => onEditBlock?.('services', { index, field, value })}
      />

      {/* 4. Emergency CTA */}
      <EmergencyCTA 
        data={emergency} 
        phone={brand.phone}
        isEditing={isEditing}
        onEdit={(field, value) => onEditBlock?.('emergency', { field, value })}
      />

      {/* 5. Authority Content Block */}
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

      {/* 6. FAQ Section */}
      <FAQSection 
        faqs={pageData.faq || []} 
        primaryColor={primaryColor}
      />

      {/* 7. Footer CTA */}
      <FooterCTA 
        brandName={brand.company_name} 
        phone={brand.phone}
        primaryColor={primaryColor}
      />
    </div>
  );
}