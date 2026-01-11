import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { MediaSlotControl } from "@/components/ui/MediaSlotControl";
import { Sparkles, Type, MessageSquare, MousePointerClick } from "lucide-react";

interface HeroSectionProps {
  bannerEnabled: boolean;
  bannerTitle: string;
  bannerDescription: string;
  bannerImageUrl: string;
  bannerBackgroundColor?: string | null;
  ctaText: string;
  ctaUrl: string;
  userId: string;
  onBannerEnabledChange: (value: boolean) => void;
  onBannerTitleChange: (value: string) => void;
  onBannerDescriptionChange: (value: string) => void;
  onBannerImageUrlChange: (value: string | null) => void;
  onBannerBackgroundColorChange?: (value: string | null) => void;
  onCtaTextChange: (value: string) => void;
  onCtaUrlChange: (value: string) => void;
}

export function HeroSection({
  bannerEnabled,
  bannerTitle,
  bannerDescription,
  bannerImageUrl,
  bannerBackgroundColor,
  ctaText,
  ctaUrl,
  userId,
  onBannerEnabledChange,
  onBannerTitleChange,
  onBannerDescriptionChange,
  onBannerImageUrlChange,
  onBannerBackgroundColorChange,
  onCtaTextChange,
  onCtaUrlChange,
}: HeroSectionProps) {
  return (
    <div className="space-y-6">
      {/* Enable Banner Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-gray-500" />
          <div>
            <p className="font-medium text-gray-900">Seção Hero</p>
            <p className="text-sm text-gray-500">
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
            <Label className="flex items-center gap-2 text-gray-700">
              <Type className="h-4 w-4 text-gray-500" />
              Título do Hero
            </Label>
            <Input
              placeholder="Ex: Soluções completas em limpeza"
              value={bannerTitle}
              onChange={(e) => onBannerTitleChange(e.target.value)}
              className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-gray-700">
              <MessageSquare className="h-4 w-4 text-gray-500" />
              Subtítulo / Descrição
            </Label>
            <Textarea
              placeholder="Ex: Transformamos ambientes com qualidade e profissionalismo"
              value={bannerDescription}
              onChange={(e) => onBannerDescriptionChange(e.target.value)}
              rows={2}
              className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* CTA */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-gray-700">
                <MousePointerClick className="h-4 w-4 text-gray-500" />
                Texto do Botão CTA
              </Label>
              <Input
                placeholder="Ex: Solicitar Orçamento"
                value={ctaText}
                onChange={(e) => onCtaTextChange(e.target.value)}
                className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-gray-700">Link do Botão</Label>
              <Input
                placeholder="https://..."
                value={ctaUrl}
                onChange={(e) => onCtaUrlChange(e.target.value)}
                className="bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Background Image/Color Control */}
          <MediaSlotControl
            label="Fundo do Hero (opcional)"
            imageUrl={bannerImageUrl || null}
            backgroundColor={bannerBackgroundColor || null}
            onImageChange={(url) => onBannerImageUrlChange(url)}
            onBackgroundColorChange={onBannerBackgroundColorChange || (() => {})}
            userId={userId}
            folder="hero-bg"
            aspectRatio="video"
            showColorOption={!!onBannerBackgroundColorChange}
            hint="Use uma imagem panorâmica (1920x600) ou escolha uma cor sólida"
          />
        </>
      )}
    </div>
  );
}
