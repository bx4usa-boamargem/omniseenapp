import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Paintbrush, Layout, Sparkles, MessageCircle, FileText } from "lucide-react";
import { UnifiedBrandSection } from "./sections/UnifiedBrandSection";
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
  logoBackgroundColor?: string | null;
  logoNegativeBackgroundColor?: string | null;
  brandDisplayMode: 'text' | 'image';
  
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
  bannerBackgroundColor?: string | null;
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
  onLogoBackgroundColorChange?: (value: string | null) => void;
  onLogoNegativeBackgroundColorChange?: (value: string | null) => void;
  onLayoutChange: (value: string) => void;
  onPrimaryColorChange: (value: string) => void;
  onSecondaryColorChange: (value: string) => void;
  onShowSearchChange: (value: boolean) => void;
  onHeaderCtaTextChange: (value: string) => void;
  onHeaderCtaUrlChange: (value: string) => void;
  onBannerEnabledChange: (value: boolean) => void;
  onBannerTitleChange: (value: string) => void;
  onBannerDescriptionChange: (value: string) => void;
  onBannerImageUrlChange: (value: string | null) => void;
  onBannerBackgroundColorChange?: (value: string | null) => void;
  onCtaTextChange: (value: string) => void;
  onCtaUrlChange: (value: string) => void;
  onBrandDescriptionChange: (value: string) => void;
  onFooterTextChange: (value: string) => void;
  onShowCategoriesFooterChange: (value: boolean) => void;
  onContactButtonsChange: (buttons: ContactButton[]) => void;
  onBrandDisplayModeChange: (mode: 'text' | 'image') => void;
}

export function MiniSiteEditor(props: MiniSiteEditorProps) {
  const {
    companyName,
    city,
    logoUrl,
    logoNegativeUrl,
    faviconUrl,
    logoBackgroundColor,
    logoNegativeBackgroundColor,
    brandDisplayMode,
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
    bannerBackgroundColor,
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
    onLogoBackgroundColorChange,
    onLogoNegativeBackgroundColorChange,
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
    onBannerBackgroundColorChange,
    onCtaTextChange,
    onCtaUrlChange,
    onBrandDescriptionChange,
    onFooterTextChange,
    onShowCategoriesFooterChange,
    onContactButtonsChange,
    onBrandDisplayModeChange,
  } = props;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Editor do Site</h2>
          <p className="text-gray-500 text-sm">
            Configure a aparência do seu mini-site
          </p>
        </div>
        <SaveIndicator status={saveStatus} />
      </div>

      {/* Unified Brand Section - Single consolidated module */}
      <UnifiedBrandSection
        companyName={companyName}
        city={city}
        logoUrl={logoUrl}
        logoNegativeUrl={logoNegativeUrl}
        faviconUrl={faviconUrl}
        logoBackgroundColor={logoBackgroundColor}
        logoNegativeBackgroundColor={logoNegativeBackgroundColor}
        primaryColor={primaryColor}
        secondaryColor={secondaryColor}
        brandDisplayMode={brandDisplayMode}
        userId={userId}
        onCompanyNameChange={onCompanyNameChange}
        onCityChange={onCityChange}
        onLogoUrlChange={onLogoUrlChange}
        onLogoNegativeUrlChange={onLogoNegativeUrlChange}
        onFaviconUrlChange={onFaviconUrlChange}
        onLogoBackgroundColorChange={onLogoBackgroundColorChange}
        onLogoNegativeBackgroundColorChange={onLogoNegativeBackgroundColorChange}
        onPrimaryColorChange={onPrimaryColorChange}
        onSecondaryColorChange={onSecondaryColorChange}
        onBrandDisplayModeChange={onBrandDisplayModeChange}
      />

      {/* Accordion Sections */}
      <Accordion type="multiple" defaultValue={["design"]} className="space-y-4">
        {/* Design (Theme Only) */}
        <AccordionItem value="design" className="border border-gray-200 rounded-xl px-4 bg-white">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Paintbrush className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Design</p>
                <p className="text-sm text-gray-500">Escolha o estilo do seu site</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6">
            <DesignSection
              layoutTemplate={layoutTemplate}
              onLayoutChange={onLayoutChange}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Header */}
        <AccordionItem value="header" className="border border-gray-200 rounded-xl px-4 bg-white">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Layout className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Cabeçalho</p>
                <p className="text-sm text-gray-500">Busca e CTA do header</p>
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
        <AccordionItem value="hero" className="border border-gray-200 rounded-xl px-4 bg-white">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-amber-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Hero / Banner</p>
                <p className="text-sm text-gray-500">Seção de destaque</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-6">
            <HeroSection
              bannerEnabled={bannerEnabled}
              bannerTitle={bannerTitle}
              bannerDescription={bannerDescription}
              bannerImageUrl={bannerImageUrl}
              bannerBackgroundColor={bannerBackgroundColor}
              ctaText={ctaText}
              ctaUrl={ctaUrl}
              userId={userId}
              onBannerEnabledChange={onBannerEnabledChange}
              onBannerTitleChange={onBannerTitleChange}
              onBannerDescriptionChange={onBannerDescriptionChange}
              onBannerImageUrlChange={onBannerImageUrlChange}
              onBannerBackgroundColorChange={onBannerBackgroundColorChange}
              onCtaTextChange={onCtaTextChange}
              onCtaUrlChange={onCtaUrlChange}
            />
          </AccordionContent>
        </AccordionItem>

        {/* Contact Buttons */}
        <AccordionItem value="contact" className="border border-gray-200 rounded-xl px-4 bg-white">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Botões de Contato</p>
                <p className="text-sm text-gray-500">WhatsApp, telefone, etc.</p>
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
        <AccordionItem value="footer" className="border border-gray-200 rounded-xl px-4 bg-white">
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gray-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-gray-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Rodapé</p>
                <p className="text-sm text-gray-500">Texto institucional</p>
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
