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
  const whatsapp = pageData.contact?.whatsapp || pageData.contact?.phone;

  return (
    <div className="w-full h-full">
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        {visibility.hero && pageData.hero && (
          <HeroBlock
            data={pageData.hero}
            whatsapp={whatsapp}
            primaryColor={primaryColor}
            isEditing={isEditing}
            onEdit={(field, value) => onEditBlock?.('hero', { field, value })}
          />
        )}

        {/* Service Cards */}
        {visibility.services && pageData.services?.length > 0 && (
          <ServiceCardsBlock
            services={pageData.services}
            phone={pageData.contact?.phone || ""}
            primaryColor={primaryColor}
            isEditing={isEditing}
            onEdit={(index, field, value) => onEditBlock?.('services', { index, field, value })}
          />
        )}

        {/* Emergency Banner */}
        {visibility.emergency_banner && pageData.emergency_banner && (
          <EmergencyBannerBlock
            data={pageData.emergency_banner}
            primaryColor={primaryColor}
            isEditing={isEditing}
            onEdit={(field, value) => onEditBlock?.('emergency_banner', { field, value })}
          />
        )}

        {/* Service Details */}
        {visibility.service_details && pageData.service_details?.length > 0 && (
          <ServiceDetailBlock
            details={pageData.service_details}
            primaryColor={primaryColor}
            isEditing={isEditing}
            onEdit={(index, field, value) => onEditBlock?.('service_details', { index, field, value })}
          />
        )}

        {/* Process Steps */}
        {visibility.process_steps && pageData.process_steps?.length > 0 && (
          <ProcessStepsBlock
            steps={pageData.process_steps}
            primaryColor={primaryColor}
            isEditing={isEditing}
            onEdit={(index, field, value) => onEditBlock?.('process_steps', { index, field, value })}
          />
        )}

        {/* Why Choose Us */}
        {visibility.why_choose_us && pageData.why_choose_us?.length > 0 && (
          <WhyChooseUsBlock
            items={pageData.why_choose_us}
            primaryColor={primaryColor}
            isEditing={isEditing}
            onEdit={(index, field, value) => onEditBlock?.('why_choose_us', { index, field, value })}
          />
        )}

        {/* Testimonials */}
        {visibility.testimonials && pageData.testimonials?.length > 0 && (
          <TestimonialsBlock
            testimonials={pageData.testimonials}
            primaryColor={primaryColor}
            isEditing={isEditing}
            onEdit={(index, field, value) => onEditBlock?.('testimonials', { index, field, value })}
          />
        )}

        {/* Areas Served */}
        {visibility.areas_served && pageData.areas_served && (
          <AreasServedBlock
            data={pageData.areas_served}
            primaryColor={primaryColor}
            mapEmbedUrl={pageData.contact?.map_embed_url}
            isEditing={isEditing}
            onEdit={(field, value) => onEditBlock?.('areas_served', { field, value })}
          />
        )}

        {/* FAQ */}
        {visibility.faq && pageData.faq?.length > 0 && (
          <FAQBlock
            faqs={pageData.faq}
            phone={pageData.contact?.phone}
            primaryColor={primaryColor}
            isEditing={isEditing}
            onEdit={(index, field, value) => onEditBlock?.('faq', { index, field, value })}
          />
        )}

        {/* CTA Banner */}
        {visibility.cta_banner && pageData.cta_banner && (
          <CTABannerBlock
            data={pageData.cta_banner}
            whatsapp={whatsapp}
            primaryColor={primaryColor}
            isEditing={isEditing}
            onEdit={(field, value) => onEditBlock?.('cta_banner', { field, value })}
          />
        )}

        {/* Contact Form */}
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
    </div>
  );
}