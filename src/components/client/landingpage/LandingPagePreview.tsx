import { ScrollArea } from "@/components/ui/scroll-area";
import { LandingPageData, BlockVisibility, DEFAULT_BLOCK_VISIBILITY } from "./types/landingPageTypes";
import {
  HeroBlock,
  ServiceCardsBlock,
  ServiceDetailBlock,
  EmergencyBannerBlock,
  TestimonialsBlock,
  AreasServedBlock,
  FAQBlock,
  ContactFormBlock,
  WhyChooseUsBlock,
  ProcessStepsBlock,
  CTABannerBlock,
} from "./blocks";
import { useMemo } from "react";

interface LandingPagePreviewProps {
  pageData: LandingPageData;
  blogId: string;
  primaryColor?: string;
  visibility?: BlockVisibility;
  isEditing?: boolean;
  onEditBlock?: (blockType: string, data: any) => void;
}

export function LandingPagePreview({
  pageData,
  blogId,
  primaryColor = "hsl(var(--primary))",
  visibility = DEFAULT_BLOCK_VISIBILITY,
  isEditing = false,
  onEditBlock,
}: LandingPagePreviewProps) {
  // CRITICAL: Removendo qualquer uso de refs ou DOM direto para evitar insertBefore error
  const whatsapp = pageData.contact?.whatsapp || pageData.contact?.phone;

  // Se pageData estiver incompleto, não renderiza nada para evitar quebra de árvore
  if (!pageData || !pageData.hero) {
    return <div className="p-10 text-center text-muted-foreground">Carregando estrutura da página...</div>;
  }

  return (
    <div className="w-full bg-background isolate">
      {/* Cada bloco em um Fragment para não poluir a árvore DOM */}
      {visibility.hero && (
        <section id="lp-hero" className="relative z-10">
          <HeroBlock
            data={pageData.hero}
            whatsapp={whatsapp}
            primaryColor={primaryColor}
            isEditing={isEditing}
            onEdit={(field, value) => onEditBlock?.('hero', { field, value })}
          />
        </section>
      )}

      {visibility.services && pageData.services?.length > 0 && (
        <section id="lp-services">
          <ServiceCardsBlock
            services={pageData.services}
            phone={pageData.contact?.phone || ""}
            primaryColor={primaryColor}
            isEditing={isEditing}
            onEdit={(index, field, value) => onEditBlock?.('services', { index, field, value })}
          />
        </section>
      )}

      {visibility.emergency_banner && pageData.emergency_banner && (
        <EmergencyBannerBlock
          data={pageData.emergency_banner}
          primaryColor={primaryColor}
          isEditing={isEditing}
          onEdit={(field, value) => onEditBlock?.('emergency_banner', { field, value })}
        />
      )}

      {visibility.service_details && pageData.service_details?.length > 0 && (
        <ServiceDetailBlock
          details={pageData.service_details}
          primaryColor={primaryColor}
          isEditing={isEditing}
          onEdit={(index, field, value) => onEditBlock?.('service_details', { index, field, value })}
        />
      )}

      {visibility.process_steps && pageData.process_steps?.length > 0 && (
        <ProcessStepsBlock
          steps={pageData.process_steps}
          primaryColor={primaryColor}
          isEditing={isEditing}
          onEdit={(index, field, value) => onEditBlock?.('process_steps', { index, field, value })}
        />
      )}

      {visibility.why_choose_us && pageData.why_choose_us?.length > 0 && (
        <WhyChooseUsBlock
          items={pageData.why_choose_us}
          primaryColor={primaryColor}
          isEditing={isEditing}
          onEdit={(index, field, value) => onEditBlock?.('why_choose_us', { index, field, value })}
        />
      )}

      {visibility.testimonials && pageData.testimonials?.length > 0 && (
        <TestimonialsBlock
          testimonials={pageData.testimonials}
          primaryColor={primaryColor}
          isEditing={isEditing}
          onEdit={(index, field, value) => onEditBlock?.('testimonials', { index, field, value })}
        />
      )}

      {visibility.areas_served && pageData.areas_served && (
        <AreasServedBlock
          data={pageData.areas_served}
          primaryColor={primaryColor}
          mapEmbedUrl={pageData.contact?.map_embed_url}
          isEditing={isEditing}
          onEdit={(field, value) => onEditBlock?.('areas_served', { field, value })}
        />
      )}

      {visibility.faq && pageData.faq?.length > 0 && (
        <FAQBlock
          faqs={pageData.faq}
          phone={pageData.contact?.phone}
          primaryColor={primaryColor}
          isEditing={isEditing}
          onEdit={(index, field, value) => onEditBlock?.('faq', { index, field, value })}
        />
      )}

      {visibility.cta_banner && pageData.cta_banner && (
        <CTABannerBlock
          data={pageData.cta_banner}
          whatsapp={whatsapp}
          primaryColor={primaryColor}
          isEditing={isEditing}
          onEdit={(field, value) => onEditBlock?.('cta_banner', { field, value })}
        />
      )}

      {visibility.contact && pageData.contact && (
        <ContactFormBlock
          contact={pageData.contact}
          blogId={blogId}
          services={pageData.services?.map(s => s.title) || []}
          primaryColor={primaryColor}
          isEditing={isEditing}
          onEdit={(field, value) => onEditBlock?.('contact', { field, value })}
        />
      )}

      {/* Footer */}
      <footer className="py-6 px-4 bg-muted/50 border-t border-border">
        <div className="container max-w-6xl mx-auto text-center text-sm text-muted-foreground">
          <p>Desenvolvido com 💜 por <strong>Omniseen</strong></p>
        </div>
      </footer>
    </div>
  );
}