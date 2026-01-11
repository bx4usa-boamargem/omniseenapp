import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Building2, Paintbrush, Layout, Sparkles, MessageCircle, FileText } from "lucide-react";
import { BrandKitSection } from "./sections/BrandKitSection";
import { BrandIdentitySection } from "./sections/BrandIdentitySection";
import { DesignSection } from "./sections/DesignSection";
import { HeaderSection } from "./sections/HeaderSection";
import { HeroSection } from "./sections/HeroSection";
import { ContactButtonsSection, ContactButton } from "./sections/ContactButtonsSection";
import { FooterSection } from "./sections/FooterSection";
import { SaveIndicator } from "./ui/SaveIndicator";

interface MiniSiteEditorProps {
  // Brand & Identity
  companyName: string;
  city: string;
  logoUrl: string;
  logoNegativeUrl: string;
  faviconUrl: string;
  
  // Design
  layoutTemplate: string;
  primaryColor: string;
  secondaryColor: string;
  
  // Header
  showSearch: boolean;
  headerCtaText: string;
  headerCtaUrl: string;
  
  // Hero
  bannerEnabled: boolean;
  bannerTitle: string;
  bannerDescription: string;
  bannerImageUrl: string;
  ctaText: string;
  ctaUrl: string;
  
  // Footer
  brandDescription: string;
  footerText: string;
  showCategoriesFooter: boolean;
  
  // Contact
  contactButtons: ContactButton[];
  
  // Meta
  userId: string;
  saveStatus: 'idle' | 'saving' | 'saved';
  
  // Callbacks
  onCompanyNameChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onLogoUrlChange: (value: string) => void;
  onLogoNegativeUrlChange: (value: string) => void;
  onFaviconUrlChange: (value: string) => void;
  onLayoutChange: (value: string) => void;
  onPrimaryColorChange: (value: string) => void;
  onSecondaryColorChange: (value: string) => void;
  onShowSearchChange: (value: boolean) => void;
  onHeaderCtaTextChange: (value: string) => void;
  onHeaderCtaUrlChange: (value: string) => void;
  onBannerEnabledChange: (value: boolean) => void;
  onBannerTitleChange: (value: string) => void;
  onBannerDescriptionChange: (value: string) => void;
  onBannerImageUrlChange: (value: string) => void;
  onCtaTextChange: (value: string) => void;
  onCtaUrlChange: (value: string) => void;
  onBrandDescriptionChange: (value: string) => void;
  onFooterTextChange: (value: string) => void;
  onShowCategoriesFooterChange: (value: boolean) => void;
  onContactButtonsChange: (buttons: ContactButton[]) => void;
}

export function MiniSiteEditor(props: MiniSiteEditorProps) {
  const {
    companyName,
    city,
    logoUrl,
    logoNegativeUrl,
    faviconUrl,
    layoutTemplate,
    primaryColor,
    secondaryColor,
    showSearch,
    headerCtaText,
    headerCtaUrl,
    bannerEnabled,
    bannerTitle,
    bannerDescription,
    bannerImageUrl,
    ctaText,
    ctaUrl,
    brandDescription,
    footerText,
    showCategoriesFooter,
    contactButtons,
    userId,
    saveStatus,
    onCompanyNameChange,
    onCityChange,
    onLogoUrlChange,
    onLogoNegativeUrlChange,
    onFaviconUrlChange,
    onLayoutChange,
    onPrimaryColorChange,
    onSecondaryColorChange,
    onShowSearchChange,
    onHeaderCtaTextChange,
    onHeaderCtaUrlChange,
    onBannerEnabledChange,
    onBannerTitleChange,
    onBannerDescriptionChange,
    onBannerImageUrlChange,
    onCtaTextChange,
    onCtaUrlChange,
    onBrandDescriptionChange,
    onFooterTextChange,
    onShowCategoriesFooterChange,
    onContactButtonsChange,
  } = props;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Editor do Site</h2>
          <p className="text-muted-foreground text-sm">
            Configure a aparência do seu mini-site
          </p>
        </div>
        <SaveIndicator status={saveStatus} />
      </div>

      {/* Brand Kit Highlight */}
      <BrandKitSection
        logoUrl={logoUrl}
        logoNegativeUrl={logoNegativeUrl}
        faviconUrl={faviconUrl}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        companyName={companyName}
      />

      {/* Accordion Sections */}
      <Accordion type="multiple" defaultValue={["identity", "design"]} className="space-y-4">
        {/* Brand Identity */}
        <AccordionItem value="identity" className="border rounded-xl px-4">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Marca e Identidade</p>
                <p className="text-sm text-muted-foreground">Nome, cidade, logos</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6">
            <BrandIdentitySection
              companyName={companyName}
              city={city}
              logoUrl={logoUrl}
              logoNegativeUrl={logoNegativeUrl}
              faviconUrl={faviconUrl}
              userId={userId}
              onCompanyNameChange={onCompanyNameChange}
              onCityChange={onCityChange}
              onLogoUrlChange={onLogoUrlChange}
              onLogoNegativeUrlChange={onLogoNegativeUrlChange}
              onFaviconUrlChange={onFaviconUrlChange}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Design */}
        <AccordionItem value="design" className="border rounded-xl px-4">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Paintbrush className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Design</p>
                <p className="text-sm text-muted-foreground">Tema e cores</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6">
            <DesignSection
              layoutTemplate={layoutTemplate}
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
              onLayoutChange={onLayoutChange}
              onPrimaryColorChange={onPrimaryColorChange}
              onSecondaryColorChange={onSecondaryColorChange}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Header */}
        <AccordionItem value="header" className="border rounded-xl px-4">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Layout className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Cabeçalho</p>
                <p className="text-sm text-muted-foreground">Busca e CTA do header</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6">
            <HeaderSection
              showSearch={showSearch}
              headerCtaText={headerCtaText}
              headerCtaUrl={headerCtaUrl}
              onShowSearchChange={onShowSearchChange}
              onHeaderCtaTextChange={onHeaderCtaTextChange}
              onHeaderCtaUrlChange={onHeaderCtaUrlChange}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Hero */}
        <AccordionItem value="hero" className="border rounded-xl px-4">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-amber-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Hero / Banner</p>
                <p className="text-sm text-muted-foreground">Seção de destaque</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6">
            <HeroSection
              bannerEnabled={bannerEnabled}
              bannerTitle={bannerTitle}
              bannerDescription={bannerDescription}
              bannerImageUrl={bannerImageUrl}
              ctaText={ctaText}
              ctaUrl={ctaUrl}
              userId={userId}
              onBannerEnabledChange={onBannerEnabledChange}
              onBannerTitleChange={onBannerTitleChange}
              onBannerDescriptionChange={onBannerDescriptionChange}
              onBannerImageUrlChange={onBannerImageUrlChange}
              onCtaTextChange={onCtaTextChange}
              onCtaUrlChange={onCtaUrlChange}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Contact Buttons */}
        <AccordionItem value="contact" className="border rounded-xl px-4">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Botões de Contato</p>
                <p className="text-sm text-muted-foreground">WhatsApp, telefone, etc.</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6">
            <ContactButtonsSection
              contactButtons={contactButtons}
              onContactButtonsChange={onContactButtonsChange}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Footer */}
        <AccordionItem value="footer" className="border rounded-xl px-4">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gray-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-gray-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Rodapé</p>
                <p className="text-sm text-muted-foreground">Texto institucional</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6">
            <FooterSection
              brandDescription={brandDescription}
              showCategoriesFooter={showCategoriesFooter}
              footerText={footerText}
              onBrandDescriptionChange={onBrandDescriptionChange}
              onShowCategoriesFooterChange={onShowCategoriesFooterChange}
              onFooterTextChange={onFooterTextChange}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
