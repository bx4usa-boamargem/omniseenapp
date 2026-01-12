import { useState, useRef } from "react";
import { Upload, Image as ImageIcon, MoreVertical, X, Palette, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PremiumLogoCardProps {
  type: "light" | "dark" | "favicon";
  imageUrl: string;
  backgroundColor?: string | null;
  companyName: string;
  userId: string;
  onImageChange: (url: string) => void;
  onImageRemove?: () => void;
  onBackgroundColorChange?: (color: string | null) => void;
}

const CARD_CONFIG = {
  light: {
    label: "Logo Clara",
    description: "Fundo claro",
    background: "bg-white",
    placeholder: "bg-gray-100",
    textColor: "#1f2937",
  },
  dark: {
    label: "Logo Escura",
    description: "Fundo escuro",
    background: "bg-gray-900",
    placeholder: "bg-gray-800",
    textColor: "#ffffff",
  },
  favicon: {
    label: "Favicon",
    description: "Ícone do site",
    background: "bg-gray-100",
    placeholder: "bg-gray-200",
    textColor: "#1f2937",
  },
};

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#22c55e", "#3b82f6", "#1f2937",
];

export function PremiumLogoCard({
  type,
  imageUrl,
  backgroundColor,
  companyName,
  userId,
  onImageChange,
  onImageRemove,
  onBackgroundColorChange,
}: PremiumLogoCardProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [customColor, setCustomColor] = useState(backgroundColor || "#6366f1");
  const inputRef = useRef<HTMLInputElement>(null);
  const config = CARD_CONFIG[type];

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${type}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("blog-assets")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("blog-assets")
        .getPublicUrl(fileName);

      // Clear background color when setting image
      if (onBackgroundColorChange) {
        onBackgroundColorChange(null);
      }
      onImageChange(urlData.publicUrl);
      toast.success("Imagem enviada com sucesso!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar imagem");
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    if (onImageRemove) {
      onImageRemove();
    } else {
      onImageChange("");
    }
    if (onBackgroundColorChange) {
      onBackgroundColorChange(null);
    }
    toast.success("Imagem removida");
  };

  const handleApplyColor = (color: string) => {
    // Clear image when setting color
    if (onImageRemove) {
      onImageRemove();
    } else {
      onImageChange("");
    }
    if (onBackgroundColorChange) {
      onBackgroundColorChange(color);
    }
    setColorDialogOpen(false);
    toast.success("Cor aplicada");
  };

  const isFavicon = type === "favicon";
  const hasImage = !!imageUrl;
  const hasColor = !!backgroundColor && !hasImage;
  const isEmpty = !hasImage && !hasColor;

  return (
    <>
      <div className="flex flex-col">
        {/* Card Container */}
        <div
          className={cn(
            "relative w-full aspect-square rounded-xl border border-gray-200 overflow-hidden flex items-center justify-center transition-all hover:shadow-md",
            isEmpty && config.background
          )}
          style={hasColor ? { backgroundColor: backgroundColor! } : undefined}
        >
          {/* Image Preview */}
          {hasImage && (
            <div className={cn(config.background, "w-full h-full flex items-center justify-center", isFavicon ? "" : "p-4")}>
              <img
                src={imageUrl}
                alt={config.label}
                className={cn(
                  "object-contain",
                  isFavicon ? "w-12 h-12" : "w-full h-full"
                )}
              />
            </div>
          )}

          {/* Color Preview */}
          {hasColor && (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Palette className="h-6 w-6 mx-auto text-white/70 mb-1" />
                <span className="text-white/90 text-xs font-medium px-2 py-0.5 bg-black/20 rounded-full">
                  {backgroundColor}
                </span>
              </div>
            </div>
          )}

          {/* Empty Placeholder */}
          {isEmpty && (
            <div
              className={cn(
                "flex items-center justify-center rounded-xl",
                isFavicon ? "w-16 h-16" : "w-20 h-20",
                config.placeholder
              )}
            >
              {isFavicon ? (
                <ImageIcon className="w-6 h-6 text-gray-400" />
              ) : (
                <span
                  className="text-2xl font-bold"
                  style={{ color: config.textColor }}
                >
                  {companyName?.charAt(0)?.toUpperCase() || "B"}
                </span>
              )}
            </div>
          )}

          {/* Loading Overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}

          {/* Hidden File Input */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
            disabled={isUploading}
          />

          {/* Actions Dropdown */}
          <div className="absolute top-2 right-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className={cn(
                    "h-7 w-7 shadow-sm",
                    type === "dark" ? "bg-white/20 hover:bg-white/30" : "bg-white/90 hover:bg-white"
                  )}
                  disabled={isUploading}
                >
                  <MoreVertical className={cn("h-4 w-4", type === "dark" ? "text-white" : "text-gray-600")} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => inputRef.current?.click()}>
                  <Upload className="h-4 w-4 mr-2" />
                  {hasImage ? "Trocar Imagem" : "Enviar Imagem"}
                </DropdownMenuItem>

                {onBackgroundColorChange && (
                  <DropdownMenuItem onClick={() => setColorDialogOpen(true)}>
                    <Palette className="h-4 w-4 mr-2" />
                    Usar Cor
                  </DropdownMenuItem>
                )}

                {(hasImage || hasColor) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleRemove}
                      className="text-red-600 focus:text-red-600"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remover
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Label Below */}
        <div className="mt-3 text-center">
          <p className="text-sm font-medium text-gray-900">{config.label}</p>
          <p className="text-xs text-gray-500">{config.description}</p>
        </div>
      </div>

      {/* Color Picker Dialog - SEPARADO do Dropdown para evitar conflito de foco */}
      <Dialog open={colorDialogOpen} onOpenChange={setColorDialogOpen}>
        <DialogContent className="sm:max-w-[300px]">
          <DialogHeader>
            <DialogTitle>Escolha uma cor</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-2">
            {/* Preset Colors */}
            <div className="grid grid-cols-4 gap-3">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  className={cn(
                    "w-10 h-10 rounded-lg border-2 transition-transform hover:scale-110",
                    customColor === color
                      ? "border-gray-900 ring-2 ring-gray-900 ring-offset-2"
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => setCustomColor(color)}
                />
              ))}
            </div>

            {/* Custom Color */}
            <div className="space-y-2">
              <Label className="text-sm">Cor personalizada</Label>
              <div className="flex items-center gap-2">
                <div
                  className="w-10 h-10 rounded-lg border-2 shrink-0"
                  style={{ backgroundColor: customColor }}
                />
                <Input
                  type="text"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  placeholder="#6366f1"
                  className="font-mono text-sm"
                />
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() => handleApplyColor(customColor)}
            >
              Aplicar Cor
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
