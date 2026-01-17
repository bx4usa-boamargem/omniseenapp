import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ImageIcon, 
  X, 
  ExternalLink, 
  MessageCircle, 
  Copy, 
  Check,
  Sparkles,
  Loader2
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ImageUpload } from "@/components/onboarding/ImageUpload";
import { SectionHelper } from "./SectionHelper";
import { useGlobalWhatsApp } from "@/hooks/useGlobalWhatsApp";
import { PhoneInput } from "@/components/ui/phone-input";

interface ObjectiveTabProps {
  ctaType: string;
  ctaText: string;
  ctaUrl: string;
  whatsappMessage: string;
  bannerTitle: string;
  bannerDescription: string;
  bannerEnabled: boolean;
  bannerImageUrl: string;
  bannerMobileImageUrl: string;
  bannerLinkUrl: string;
  blogId: string;
  userId: string;
  logoUrl: string;
  onLogoUrlChange: (value: string) => void;
  onCtaTypeChange: (value: string) => void;
  onCtaTextChange: (value: string) => void;
  onCtaUrlChange: (value: string) => void;
  onWhatsappMessageChange: (value: string) => void;
  onBannerTitleChange: (value: string) => void;
  onBannerDescriptionChange: (value: string) => void;
  onBannerEnabledChange: (value: boolean) => void;
  onBannerImageUrlChange: (value: string) => void;
  onBannerMobileImageUrlChange: (value: string) => void;
  onBannerLinkUrlChange: (value: string) => void;
}

export function ObjectiveTab({
  ctaType,
  ctaText,
  ctaUrl,
  whatsappMessage,
  bannerTitle,
  bannerDescription,
  bannerEnabled,
  bannerImageUrl,
  bannerMobileImageUrl,
  bannerLinkUrl,
  blogId,
  userId,
  logoUrl,
  onLogoUrlChange,
  onCtaTypeChange,
  onCtaTextChange,
  onCtaUrlChange,
  onWhatsappMessageChange,
  onBannerTitleChange,
  onBannerDescriptionChange,
  onBannerEnabledChange,
  onBannerImageUrlChange,
  onBannerMobileImageUrlChange,
  onBannerLinkUrlChange,
}: ObjectiveTabProps) {
  const [useCustomImage, setUseCustomImage] = useState(!!bannerImageUrl);
  const [useMobileImage, setUseMobileImage] = useState(!!bannerMobileImageUrl);
  const [copied, setCopied] = useState(false);
  const [bannerPrompt, setBannerPrompt] = useState("");
  const [generatingBanner, setGeneratingBanner] = useState(false);

  // Use global WhatsApp configuration from parent account
  const { buildLink: buildWhatsAppLink, previewMessage } = useGlobalWhatsApp();

  // Generate WhatsApp link using global template
  const whatsappLink = ctaType === "whatsapp" && ctaUrl 
    ? buildWhatsAppLink({ phone: ctaUrl })
    : "";

  const handleCopyLink = async () => {
    if (!whatsappLink) return;
    try {
      await navigator.clipboard.writeText(whatsappLink);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const handleGenerateBanner = async () => {
    if (!bannerPrompt.trim()) {
      toast.error("Digite uma descrição para o banner");
      return;
    }

    setGeneratingBanner(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-image-flux", {
        body: {
          prompt: `Professional CTA banner for a blog. ${bannerPrompt}. Style: modern, clean, business-oriented. Horizontal format 1200x400 for desktop banner.`,
          blogId,
        },
      });

      if (error) throw error;
      if (data?.imageUrl) {
        onBannerImageUrlChange(data.imageUrl);
        toast.success("Banner gerado com sucesso!");
        setBannerPrompt("");
      }
    } catch (error) {
      console.error("Error generating banner:", error);
      toast.error("Erro ao gerar banner");
    } finally {
      setGeneratingBanner(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Logo Upload */}
      <div className="space-y-4">
        <SectionHelper
          title="Logo da Empresa"
          description="Sua marca será exibida no cabeçalho e rodapé do blog. Uma logo profissional aumenta a credibilidade e reconhecimento da sua empresa."
          action="Faça upload de uma imagem PNG com fundo transparente para melhor resultado."
        />
        
        <ImageUpload
          label="Logo principal"
          value={logoUrl}
          onChange={onLogoUrlChange}
          userId={userId}
          folder={`logo-${blogId}`}
          hint="Também editável na aba Design"
          aspectRatio="aspect-[3/1]"
        />
      </div>

      {/* CTA Configuration */}
      <div className="space-y-4">
        <SectionHelper
          title="Botão de Ação (CTA)"
          description="Este é o botão principal que aparece nos artigos e no banner. Ele direciona seus leitores para uma ação de conversão, como acessar uma página ou iniciar uma conversa."
          action="Escolha entre redirecionar para um link (landing page, formulário) ou abrir uma conversa no WhatsApp."
        />

        {/* CTA Type Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => onCtaTypeChange("link")}
            className={cn(
              "border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md",
              ctaType === "link"
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/50"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                ctaType === "link" ? "bg-primary/20" : "bg-muted"
              )}>
                <ExternalLink className={cn(
                  "h-5 w-5",
                  ctaType === "link" ? "text-primary" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-medium text-sm">Enviar para um link</p>
                <p className="text-xs text-muted-foreground">Site, landing page, etc.</p>
              </div>
            </div>
          </div>

          <div
            onClick={() => onCtaTypeChange("whatsapp")}
            className={cn(
              "border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-md",
              ctaType === "whatsapp"
                ? "border-green-500 bg-green-50 dark:bg-green-950/30 shadow-sm"
                : "border-border hover:border-green-300"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                ctaType === "whatsapp" ? "bg-green-100 dark:bg-green-900/50" : "bg-muted"
              )}>
                <MessageCircle className={cn(
                  "h-5 w-5",
                  ctaType === "whatsapp" ? "text-green-600" : "text-muted-foreground"
                )} />
              </div>
              <div>
                <p className="font-medium text-sm">Chamar no WhatsApp</p>
                <p className="text-xs text-muted-foreground">Conversão direta</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Texto do botão</Label>
            <Input
              value={ctaText}
              onChange={(e) => onCtaTextChange(e.target.value)}
              placeholder={ctaType === "whatsapp" ? "Fale conosco" : "Saiba mais"}
            />
          </div>

          {ctaType === "link" ? (
            <div className="space-y-2">
              <Label>URL de destino</Label>
              <Input
                value={ctaUrl}
                onChange={(e) => onCtaUrlChange(e.target.value)}
                placeholder="https://seusite.com"
              />
            </div>
          ) : (
            <div className="space-y-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  Número do WhatsApp
                </Label>
                <PhoneInput
                  value={ctaUrl}
                  onChange={onCtaUrlChange}
                />
                <p className="text-xs text-muted-foreground">
                  Selecione o país e digite o número local
                </p>
              </div>

              <div className="space-y-2">
                <Label>Mensagem de abertura (opcional)</Label>
                <Textarea
                  value={whatsappMessage}
                  onChange={(e) => onWhatsappMessageChange(e.target.value)}
                  placeholder="Olá, vim do blog de vocês e gostaria de..."
                  rows={2}
                  className="bg-white dark:bg-background"
                />
              </div>

              {ctaUrl && (
                <div className="space-y-2">
                  <Label>Link gerado automaticamente</Label>
                  <div className="flex gap-2">
                    <Input
                      value={whatsappLink}
                      readOnly
                      className="bg-white dark:bg-background text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyLink}
                      className="shrink-0"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Banner Configuration */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <SectionHelper
            title="Banner de Chamada para Ação"
            description="Este banner é exibido ao final de cada artigo e página do blog. É sua última chance de converter o visitante antes que ele saia."
            action="Defina um título chamativo, uma descrição persuasiva e uma imagem de fundo impactante."
          />
          <Switch
            checked={bannerEnabled}
            onCheckedChange={onBannerEnabledChange}
            className="mt-1"
          />
        </div>

        {bannerEnabled && (
          <div className="space-y-4 pl-4 border-l-2 border-primary/20">
            <div className="space-y-2">
              <Label>Título do banner</Label>
              <Input
                value={bannerTitle}
                onChange={(e) => onBannerTitleChange(e.target.value)}
                placeholder="Pronto para começar?"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição do banner</Label>
              <Textarea
                value={bannerDescription}
                onChange={(e) => onBannerDescriptionChange(e.target.value)}
                placeholder="Entre em contato e descubra como podemos ajudar..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>URL de destino do banner</Label>
              <Input
                value={bannerLinkUrl}
                onChange={(e) => onBannerLinkUrlChange(e.target.value)}
                placeholder="https://seusite.com/contato"
              />
              <p className="text-xs text-muted-foreground">
                Para onde o usuário vai ao clicar no banner
              </p>
            </div>

            {/* Custom Image Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Usar imagem de fundo customizada</Label>
                <p className="text-xs text-muted-foreground">Recomendado: 1200x400px</p>
              </div>
              <Switch
                checked={useCustomImage}
                onCheckedChange={(checked) => {
                  setUseCustomImage(checked);
                  if (!checked) {
                    onBannerImageUrlChange("");
                    setUseMobileImage(false);
                    onBannerMobileImageUrlChange("");
                  }
                }}
              />
            </div>

            {useCustomImage && (
              <>
                {/* AI Banner Generation */}
                <div className="space-y-3 p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Gerar banner com IA
                    </Label>
                    <Badge variant="secondary" className="text-xs">Novo</Badge>
                  </div>

                  <Textarea
                    value={bannerPrompt}
                    onChange={(e) => setBannerPrompt(e.target.value)}
                    placeholder="Descreva o banner que deseja criar. Ex: Banner promocional roxo com o texto 'Fale conosco' e ícone de WhatsApp"
                    rows={2}
                    className="bg-white dark:bg-background"
                  />

                  <Button
                    onClick={handleGenerateBanner}
                    disabled={generatingBanner || !bannerPrompt.trim()}
                    className="w-full"
                    variant="outline"
                  >
                    {generatingBanner ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Gerar imagem com IA
                      </>
                    )}
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Imagem desktop</Label>
                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    {bannerImageUrl ? (
                      <div className="relative">
                        <img
                          src={bannerImageUrl}
                          alt="Banner desktop"
                          className="max-h-32 mx-auto rounded"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-0 right-0 h-6 w-6"
                          onClick={() => onBannerImageUrlChange("")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <ImageIcon className="h-8 w-8 mx-auto text-muted-foreground" />
                        <Input
                          type="text"
                          value={bannerImageUrl}
                          onChange={(e) => onBannerImageUrlChange(e.target.value)}
                          placeholder="Cole a URL da imagem"
                          className="max-w-sm mx-auto"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Imagem diferente para celulares</Label>
                    <p className="text-xs text-muted-foreground">Recomendado: 600x400px</p>
                  </div>
                  <Switch
                    checked={useMobileImage}
                    onCheckedChange={(checked) => {
                      setUseMobileImage(checked);
                      if (!checked) onBannerMobileImageUrlChange("");
                    }}
                  />
                </div>

                {useMobileImage && (
                  <div className="space-y-2">
                    <Label>Imagem mobile</Label>
                    <div className="border-2 border-dashed rounded-lg p-4 text-center">
                      {bannerMobileImageUrl ? (
                        <div className="relative inline-block">
                          <img
                            src={bannerMobileImageUrl}
                            alt="Banner mobile"
                            className="max-h-32 rounded"
                          />
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute top-0 right-0 h-6 w-6"
                            onClick={() => onBannerMobileImageUrlChange("")}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={bannerMobileImageUrl}
                          onChange={(e) => onBannerMobileImageUrlChange(e.target.value)}
                          placeholder="Cole a URL da imagem mobile"
                          className="max-w-sm mx-auto"
                        />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
