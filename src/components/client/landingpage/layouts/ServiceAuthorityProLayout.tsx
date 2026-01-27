import { 
  ServiceAuthorityProPageData, 
  ProBlockVisibility, 
  DEFAULT_PRO_VISIBILITY 
} from "../types/serviceAuthorityProTypes";
import {
  ProHeroSection,
  ProServiceCardGrid,
  DeepDiveSection,
  LocalContextSection,
  InspectionSection,
  MaterialsSection,
  AreasServedSection,
  ProFAQSection,
  TestimonialsSection,
  ProFooterCTA,
  ProEmergencyBanner,
  ProCallStrip,
} from "./pro";

interface ServiceAuthorityProLayoutProps {
  pageData: ServiceAuthorityProPageData;
  primaryColor: string;
  visibility?: ProBlockVisibility;
  isEditing?: boolean;
  onEditBlock?: (blockType: string, data: any) => void;
}

export function ServiceAuthorityProLayout({
  pageData,
  primaryColor,
  visibility = DEFAULT_PRO_VISIBILITY,
  isEditing = false,
  onEditBlock,
}: ServiceAuthorityProLayoutProps) {
  const v = visibility;
  const phone = pageData.brand?.phone;

  console.log("[ServiceAuthorityProLayout] Rendering PRO template with visibility:", v);

  return (
    <div className="w-full bg-white landing-page-pro">
      {/* Template Badge */}
      <div className="bg-gradient-to-r from-purple-600 to-orange-500 text-white text-[10px] px-3 py-1 uppercase tracking-widest font-bold text-center">
        ⭐ Super Página PRO - Service Authority v2.0
      </div>

      {/* SEÇÃO 1: Hero */}
      {v.hero && pageData.hero && (
        <ProHeroSection 
          data={pageData.hero} 
          phone={phone} 
          primaryColor={primaryColor} 
        />
      )}

      {/* Call Strip (always visible if phone exists) */}
      {phone && (
        <ProCallStrip phone={phone} primaryColor={primaryColor} />
      )}

      {/* SEÇÃO 2: Service Cards (4 cards com imagem) */}
      {v.service_cards && pageData.service_cards?.length > 0 && (
        <ProServiceCardGrid 
          cards={pageData.service_cards} 
          phone={phone}
          primaryColor={primaryColor} 
        />
      )}

      {/* SEÇÃO 3: Emergency Banner */}
      {v.emergency && pageData.emergency && (
        <ProEmergencyBanner 
          data={pageData.emergency} 
          phone={phone}
          primaryColor={primaryColor} 
        />
      )}

      {/* SEÇÕES 4-5: Deep Dives (alternância imagem/texto) */}
      {v.deep_dives && pageData.deep_dives?.map((dive, i) => (
        <DeepDiveSection 
          key={dive.id || i} 
          data={dive} 
          reverse={i % 2 === 1}
          phone={phone}
          primaryColor={primaryColor} 
        />
      ))}

      {/* SEÇÃO 6: Local Context (4 imagens) */}
      {v.local_context && pageData.local_context && (
        <LocalContextSection 
          data={pageData.local_context} 
          primaryColor={primaryColor} 
        />
      )}

      {/* SEÇÃO 7: Inspection Process */}
      {v.inspection_process && pageData.inspection_process && (
        <InspectionSection 
          data={pageData.inspection_process} 
          primaryColor={primaryColor} 
        />
      )}

      {/* SEÇÃO 8: Materials Quality */}
      {v.materials_quality && pageData.materials_quality && (
        <MaterialsSection 
          data={pageData.materials_quality} 
          primaryColor={primaryColor} 
        />
      )}

      {/* SEÇÃO 9: Areas Served */}
      {v.areas_served && pageData.areas_served && (
        <AreasServedSection 
          data={pageData.areas_served} 
          primaryColor={primaryColor} 
        />
      )}

      {/* SEÇÃO 10: FAQ */}
      {v.faq && pageData.faq?.length > 0 && (
        <ProFAQSection 
          faqs={pageData.faq} 
          primaryColor={primaryColor} 
        />
      )}

      {/* SEÇÃO 11: Testimonials */}
      {v.testimonials && pageData.testimonials?.length > 0 && (
        <TestimonialsSection 
          testimonials={pageData.testimonials} 
          primaryColor={primaryColor} 
        />
      )}

      {/* SEÇÃO 12: Footer CTA */}
      {v.footer_cta && pageData.footer_cta && (
        <ProFooterCTA 
          data={pageData.footer_cta} 
          primaryColor={primaryColor} 
        />
      )}

      {/* Footer */}
      <footer className="py-6 px-4 bg-slate-100 border-t border-slate-200">
        <div className="container max-w-6xl mx-auto text-center">
          <p className="text-sm text-slate-500">
            Desenvolvido com 💜 por <strong>Omniseen</strong>
          </p>
        </div>
      </footer>
    </div>
  );
}
