import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PremiumLogoCard } from "../ui/PremiumLogoCard";
import { PremiumColorCard } from "../ui/PremiumColorCard";
import { PremiumPaletteStrip } from "../ui/PremiumPaletteStrip";
import { Building2, Palette, Image } from "lucide-react";

interface UnifiedBrandSectionProps {
  // Brand Data
  companyName: string;
  city: string;
  
  // Logos
  logoUrl: string;
  logoNegativeUrl: string;
  faviconUrl: string;
  
  // Logo Background Colors
  logoBackgroundColor?: string | null;
  logoNegativeBackgroundColor?: string | null;
  
  // Colors
  primaryColor: string;
  secondaryColor: string;
  
  // Meta
  userId: string;
  
  // Callbacks
  onCompanyNameChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onLogoUrlChange: (value: string) => void;
  onLogoNegativeUrlChange: (value: string) => void;
  onFaviconUrlChange: (value: string) => void;
  onLogoBackgroundColorChange?: (value: string | null) => void;
  onLogoNegativeBackgroundColorChange?: (value: string | null) => void;
  onPrimaryColorChange: (value: string) => void;
  onSecondaryColorChange: (value: string) => void;
}

export function UnifiedBrandSection({
  companyName,
  city,
  logoUrl,
  logoNegativeUrl,
  faviconUrl,
  logoBackgroundColor,
  logoNegativeBackgroundColor,
  primaryColor,
  secondaryColor,
  userId,
  onCompanyNameChange,
  onCityChange,
  onLogoUrlChange,
  onLogoNegativeUrlChange,
  onFaviconUrlChange,
  onLogoBackgroundColorChange,
  onLogoNegativeBackgroundColorChange,
  onPrimaryColorChange,
  onSecondaryColorChange,
}: UnifiedBrandSectionProps) {
  return (
    <div className="p-8 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-10">
      {/* Section Header */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900">Identidade da Marca</h3>
        <p className="text-sm text-gray-500 mt-1">
          Configure os dados, logos e cores da sua marca
        </p>
      </div>

      {/* Brand Data Section */}
      <div className="space-y-5">
        <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Dados da Marca
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-gray-700">Nome da Empresa</Label>
            <Input
              value={companyName}
              onChange={(e) => onCompanyNameChange(e.target.value)}
              placeholder="Sua Empresa"
              className="bg-white border-gray-200 text-gray-900"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-700">Cidade / Região</Label>
            <Input
              value={city}
              onChange={(e) => onCityChange(e.target.value)}
              placeholder="São Paulo, SP"
              className="bg-white border-gray-200 text-gray-900"
            />
          </div>
        </div>
      </div>

      {/* Logos Section */}
      <div className="space-y-5">
        <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <Image className="h-4 w-4" />
          Logos
        </h4>
        <p className="text-xs text-gray-500 -mt-3">
          Envie imagens, use cores sólidas ou deixe vazio para usar o placeholder padrão
        </p>
        <div className="grid grid-cols-3 gap-6">
          <PremiumLogoCard
            type="light"
            imageUrl={logoUrl}
            backgroundColor={logoBackgroundColor}
            companyName={companyName}
            userId={userId}
            onImageChange={onLogoUrlChange}
            onImageRemove={() => onLogoUrlChange('')}
            onBackgroundColorChange={onLogoBackgroundColorChange}
          />
          <PremiumLogoCard
            type="dark"
            imageUrl={logoNegativeUrl}
            backgroundColor={logoNegativeBackgroundColor}
            companyName={companyName}
            userId={userId}
            onImageChange={onLogoNegativeUrlChange}
            onImageRemove={() => onLogoNegativeUrlChange('')}
            onBackgroundColorChange={onLogoNegativeBackgroundColorChange}
          />
          <PremiumLogoCard
            type="favicon"
            imageUrl={faviconUrl}
            companyName={companyName}
            userId={userId}
            onImageChange={onFaviconUrlChange}
            onImageRemove={() => onFaviconUrlChange('')}
          />
        </div>
      </div>

      {/* Colors Section */}
      <div className="space-y-5">
        <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Cores da Marca
        </h4>
        <div className="grid grid-cols-2 gap-8">
          <PremiumColorCard
            color={primaryColor}
            label="Primária"
            onChange={onPrimaryColorChange}
          />
          <PremiumColorCard
            color={secondaryColor}
            label="Secundária"
            onChange={onSecondaryColorChange}
          />
        </div>
      </div>

      {/* Generated Palette Section */}
      <div className="space-y-5">
        <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
          Paleta Gerada
        </h4>
        <PremiumPaletteStrip primaryColor={primaryColor} />
        
        {/* Gradient Preview */}
        <div className="pt-4">
          <p className="text-sm text-gray-500 mb-3">Preview do gradiente</p>
          <div 
            className="h-16 rounded-lg"
            style={{
              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
            }}
          />
        </div>
      </div>
    </div>
  );
}
