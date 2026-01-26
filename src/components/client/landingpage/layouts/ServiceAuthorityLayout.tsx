import { LandingPageData } from "../types/landingPageTypes";
import { AuthorityHero } from "./AuthorityHero";
import { CallNowStrip } from "./CallNowStrip";
import { ServiceCardGrid } from "./ServiceCardGrid";
import { EmergencyCTA } from "./EmergencyCTA";
import { AuthorityContentBlock } from "./AuthorityContentBlock";
import { FAQSection } from "./FAQSection";
import { FooterCTA } from "./FooterCTA";

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
  // Extract data with fallbacks to avoid crashes during transitions
  const hero = pageData.hero || {};
  const services = pageData.services || [];
  const emergency = pageData.emergency || {};
  const authorityContent = pageData.authority_content || {};
  const brand = pageData.brand || {};

  return (
    <div className="w-full bg-white text-slate-900 font-sans selection:bg-blue-100">
      {/* 1. Authority Hero */}
      <AuthorityHero 
        data={hero} 
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

      {/* 5. Authority Content Block (The Core SEO Long-form) */}
      <AuthorityContentBlock 
        data={authorityContent} 
        primaryColor={primaryColor}
      />

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
