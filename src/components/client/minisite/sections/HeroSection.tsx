import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "@/components/onboarding/ImageUpload";
import { Sparkles, Type, MessageSquare, MousePointerClick, Image } from "lucide-react";

interface HeroSectionProps {
  bannerEnabled: boolean;
  bannerTitle: string;
  bannerDescription: string;
  bannerImageUrl: string;
  ctaText: string;
  ctaUrl: string;
  userId: string;
  onBannerEnabledChange: (value: boolean) => void;
  onBannerTitleChange: (value: string) => void;
  onBannerDescriptionChange: (value: string) => void;
  onBannerImageUrlChange: (value: string) => void;
  onCtaTextChange: (value: string) => void;
  onCtaUrlChange: (value: string) => void;
}

export function HeroSection({
  bannerEnabled,
  bannerTitle,
  bannerDescription,
  bannerImageUrl,
  ctaText,
  ctaUrl,
  userId,
  onBannerEnabledChange,
  onBannerTitleChange,
  onBannerDescriptionChange,
  onBannerImageUrlChange,
  onCtaTextChange,
  onCtaUrlChange,
}: HeroSectionProps) {
  return (
    <div className="space-y-6">
      {/* Enable Banner Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">Seção Hero</p>
            <p className="text-sm text-muted-foreground">
              Banner destacado no topo do site
            </p>
          </div>
        </div>
        <Switch
          checked={bannerEnabled}
          onCheckedChange={onBannerEnabledChange}
        />
      </div>

      {bannerEnabled && (
        <>
          {/* Title */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Título do Hero
            </Label>
            <Input
              placeholder="Ex: Soluções completas em limpeza"
              value={bannerTitle}
              onChange={(e) => onBannerTitleChange(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Subtítulo / Descrição
            </Label>
            <Textarea
              placeholder="Ex: Transformamos ambientes com qualidade e profissionalismo"
              value={bannerDescription}
              onChange={(e) => onBannerDescriptionChange(e.target.value)}
              rows={2}
            />
          </div>

          {/* CTA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4" />
                Texto do Botão CTA
              </Label>
              <Input
                placeholder="Ex: Solicitar Orçamento"
                value={ctaText}
                onChange={(e) => onCtaTextChange(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Link do Botão</Label>
              <Input
                placeholder="https://..."
                value={ctaUrl}
                onChange={(e) => onCtaUrlChange(e.target.value)}
              />
            </div>
          </div>

          {/* Background Image */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Imagem de Fundo (opcional)
            </Label>
            <ImageUpload
              label=""
              value={bannerImageUrl}
              onChange={onBannerImageUrlChange}
              userId={userId}
              folder="hero-bg"
              aspectRatio="aspect-video"
              hint="Imagem panorâmica recomendada (1920x600)"
            />
          </div>
        </>
      )}
    </div>
  );
}
