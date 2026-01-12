import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PremiumLogoCard } from "../ui/PremiumLogoCard";
import { PremiumColorCard } from "../ui/PremiumColorCard";
import { PremiumPaletteStrip } from "../ui/PremiumPaletteStrip";
import { Building2, Palette, Image, Type } from "lucide-react";
import { cn } from "@/lib/utils";

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
  
  // Brand Display Mode
  brandDisplayMode: 'text' | 'image';
  
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
  onBrandDisplayModeChange: (mode: 'text' | 'image') => void;
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
  brandDisplayMode,
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
  onBrandDisplayModeChange,
}: UnifiedBrandSectionProps) {
  return (
    <div className="p-8 rounded-2xl bg-white border border-gray-100 shadow-sm space-y-10">
      {/* Section Header */}
      <div>
        <h3 className="text-xl font-semibold text-gray-900">Identidade da Marca</h3>
        <p className="text-sm text-gray-500 mt-1">
          Escolha como sua marca aparecerá no blog. Você pode usar apenas o nome da empresa 
          ou enviar sua logomarca. Para melhor resultado com imagem, envie uma versão clara 
          e outra para fundos escuros.
        </p>
      </div>

      {/* Brand Display Mode Toggle */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
          Modo de Exibição
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => onBrandDisplayModeChange('text')}
            className={cn(
              "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all",
              brandDisplayMode === 'text'
                ? "border-primary bg-primary/5 shadow-md"
                : "border-gray-200 hover:border-gray-300 bg-white"
            )}
          >
            <div className={cn(
              "p-3 rounded-full",
              brandDisplayMode === 'text' ? "bg-primary/10" : "bg-gray-100"
            )}>
              <Type className={cn(
                "h-6 w-6",
                brandDisplayMode === 'text' ? "text-primary" : "text-gray-500"
              )} />
            </div>
            <div className="text-center">
              <p className={cn(
                "font-semibold",
                brandDisplayMode === 'text' ? "text-primary" : "text-gray-700"
              )}>
                Usar Nome
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Exibe o nome da empresa
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onBrandDisplayModeChange('image')}
            className={cn(
              "flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all",
              brandDisplayMode === 'image'
                ? "border-primary bg-primary/5 shadow-md"
                : "border-gray-200 hover:border-gray-300 bg-white"
            )}
          >
            <div className={cn(
              "p-3 rounded-full",
              brandDisplayMode === 'image' ? "bg-primary/10" : "bg-gray-100"
            )}>
              <Image className={cn(
                "h-6 w-6",
                brandDisplayMode === 'image' ? "text-primary" : "text-gray-500"
              )} />
            </div>
            <div className="text-center">
              <p className={cn(
                "font-semibold",
                brandDisplayMode === 'image' ? "text-primary" : "text-gray-700"
              )}>
                Usar Logo
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Exibe sua logomarca
              </p>
            </div>
          </button>
        </div>
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
            {brandDisplayMode === 'text' && (
              <p className="text-xs text-gray-500">
                Este nome será exibido no header e footer do blog
              </p>
            )}
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

      {/* Logos Section - Only show full options when image mode */}
      <div className="space-y-5">
        <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <Image className="h-4 w-4" />
          Logos
        </h4>
        <p className="text-xs text-gray-500 -mt-3">
          {brandDisplayMode === 'image' 
            ? "Envie logos para fundo claro (header) e fundo escuro (footer)"
            : "Mesmo no modo texto, você pode configurar um favicon"}
        </p>
        <div className={cn(
          "grid gap-6",
          brandDisplayMode === 'image' ? "grid-cols-3" : "grid-cols-1 max-w-xs"
        )}>
          {brandDisplayMode === 'image' && (
            <>
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
            </>
          )}
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

      {/* Brand Preview Section */}
      <div className="space-y-5">
        <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
          Preview da Marca
        </h4>
        <p className="text-xs text-gray-500 -mt-3">
          Veja como sua marca aparecerá no header e footer do blog
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Header Preview (light background) */}
          <div className="p-4 bg-white rounded-lg border border-gray-200">
            <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Header</p>
            <div className="flex items-center gap-3 py-2">
              {brandDisplayMode === 'image' && logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Logo Preview" 
                  className="h-10 w-auto object-contain" 
                />
              ) : (
                <span className="font-heading font-semibold text-lg text-gray-900">
                  {companyName || 'Nome da Empresa'}
                </span>
              )}
            </div>
          </div>
          
          {/* Footer Preview (dark background with primary color) */}
          <div 
            className="p-4 rounded-lg"
            style={{ backgroundColor: primaryColor || '#6366f1' }}
          >
            <p className="text-xs text-white/60 mb-3 uppercase tracking-wide">Footer</p>
            <div className="flex items-center gap-3 py-2">
              {brandDisplayMode === 'image' && (logoNegativeUrl || logoUrl) ? (
                <img 
                  src={logoNegativeUrl || logoUrl} 
                  alt="Logo Preview" 
                  className="h-8 w-auto object-contain" 
                />
              ) : (
                <span className="font-heading font-semibold text-lg text-white">
                  {companyName || 'Nome da Empresa'}
                </span>
              )}
            </div>
          </div>
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