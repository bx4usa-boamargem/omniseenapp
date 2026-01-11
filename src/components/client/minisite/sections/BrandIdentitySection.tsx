import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUpload } from "@/components/onboarding/ImageUpload";
import { Building2, MapPin } from "lucide-react";

interface BrandIdentitySectionProps {
  companyName: string;
  city: string;
  logoUrl: string;
  logoNegativeUrl: string;
  faviconUrl: string;
  userId: string;
  onCompanyNameChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onLogoUrlChange: (value: string) => void;
  onLogoNegativeUrlChange: (value: string) => void;
  onFaviconUrlChange: (value: string) => void;
}

export function BrandIdentitySection({
  companyName,
  city,
  logoUrl,
  logoNegativeUrl,
  faviconUrl,
  userId,
  onCompanyNameChange,
  onCityChange,
  onLogoUrlChange,
  onLogoNegativeUrlChange,
  onFaviconUrlChange,
}: BrandIdentitySectionProps) {
  return (
    <div className="space-y-6">
      {/* Company Name */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Nome da Empresa
        </Label>
        <Input
          placeholder="Ex: Limpeza Express"
          value={companyName}
          onChange={(e) => onCompanyNameChange(e.target.value)}
        />
      </div>

      {/* City */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Cidade / Região
        </Label>
        <Input
          placeholder="Ex: São Paulo, SP"
          value={city}
          onChange={(e) => onCityChange(e.target.value)}
        />
      </div>

      {/* Logos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ImageUpload
          label="Logo (fundo claro)"
          value={logoUrl}
          onChange={onLogoUrlChange}
          userId={userId}
          folder="logo"
          aspectRatio="aspect-square"
          hint="PNG transparente recomendado"
        />
        
        <ImageUpload
          label="Logo (fundo escuro)"
          value={logoNegativeUrl}
          onChange={onLogoNegativeUrlChange}
          userId={userId}
          folder="logo-negative"
          aspectRatio="aspect-square"
          hint="Versão branca/clara"
        />
        
        <ImageUpload
          label="Favicon"
          value={faviconUrl}
          onChange={onFaviconUrlChange}
          userId={userId}
          folder="favicon"
          aspectRatio="aspect-square"
          hint="32x32 ou 64x64 pixels"
        />
      </div>
    </div>
  );
}
