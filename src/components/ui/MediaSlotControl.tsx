import { useState, useRef } from "react";
import { Upload, X, Palette, MoreVertical, Image as ImageIcon, Loader2 } from "lucide-react";
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

interface MediaSlotControlProps {
  // Estado atual
  imageUrl: string | null;
  backgroundColor: string | null;
  
  // Callbacks
  onImageChange: (url: string | null) => void;
  onBackgroundColorChange: (color: string | null) => void;
  
  // Configuração visual
  label: string;
  aspectRatio?: "square" | "video" | "banner";
  previewBackground?: "light" | "dark" | "checkered";
  
  // Upload config
  userId: string;
  folder: string;
  accept?: string;
  
  // Opções
  showColorOption?: boolean;
  colorPickerLabel?: string;
  placeholder?: React.ReactNode;
  hint?: string;
}

const PRESET_COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#ec4899", // Pink
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#14b8a6", // Teal
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#1f2937", // Gray 800
  "#111827", // Gray 900
];

export function MediaSlotControl({
  imageUrl,
  backgroundColor,
  onImageChange,
  onBackgroundColorChange,
  label,
  aspectRatio = "video",
  previewBackground = "checkered",
  userId,
  folder,
  accept = "image/*",
  showColorOption = true,
  colorPickerLabel = "Usar Cor Sólida",
  placeholder,
  hint,
}: MediaSlotControlProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [customColor, setCustomColor] = useState(backgroundColor || "#6366f1");
  const inputRef = useRef<HTMLInputElement>(null);

  const aspectRatioClass = {
    square: "aspect-square",
    video: "aspect-video",
    banner: "aspect-[3/1]",
  }[aspectRatio];

  const backgroundClass = {
    light: "bg-white",
    dark: "bg-gray-900",
    checkered: "bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3QgZmlsbD0iI2YwZjBmMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIi8+PHJlY3QgZmlsbD0iI2UwZTBlMCIgeD0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIvPjxyZWN0IGZpbGw9IiNlMGUwZTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiLz48cmVjdCBmaWxsPSIjZjBmMGYwIiB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIvPjwvc3ZnPg==')]",
  }[previewBackground];

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${userId}/${folder}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("blog-branding")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("blog-branding")
        .getPublicUrl(fileName);

      // Clear background color when setting image
      onBackgroundColorChange(null);
      onImageChange(urlData.publicUrl);
      toast.success("Imagem enviada com sucesso!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao enviar imagem");
    } finally {
      setIsUploading(false);
      // Reset input
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = () => {
    onImageChange(null);
    onBackgroundColorChange(null);
    toast.success("Fundo removido");
  };

  const handleApplyColor = (color: string) => {
    onImageChange(null); // Clear image when setting color
    onBackgroundColorChange(color);
    setShowColorPicker(false);
    toast.success("Cor aplicada");
  };

  // Determine what to render
  const hasImage = !!imageUrl;
  const hasColor = !!backgroundColor && !hasImage;
  const isEmpty = !hasImage && !hasColor;

  return (
    <div className="space-y-3">
      {label && (
        <Label className="text-gray-700 flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-gray-500" />
          {label}
        </Label>
      )}

      {/* Preview Area */}
      <div
        className={cn(
          "relative w-full rounded-xl border border-gray-200 overflow-hidden",
          aspectRatioClass,
          isEmpty && backgroundClass
        )}
        style={hasColor ? { backgroundColor: backgroundColor! } : undefined}
      >
        {/* Image Preview */}
        {hasImage && (
          <img
            src={imageUrl!}
            alt={label}
            className="w-full h-full object-cover"
          />
        )}

        {/* Color Preview */}
        {hasColor && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <Palette className="h-8 w-8 mx-auto text-white/70 mb-2" />
              <span className="text-white/90 text-sm font-medium px-3 py-1 bg-black/20 rounded-full">
                {backgroundColor}
              </span>
            </div>
          </div>
        )}

        {/* Empty Placeholder */}
        {isEmpty && (
          <div className="w-full h-full flex items-center justify-center">
            {placeholder || (
              <div className="text-center text-gray-400">
                <ImageIcon className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma imagem ou cor</p>
              </div>
            )}
          </div>
        )}

        {/* Loading Overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        {/* Hidden File Input */}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
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
                className="h-8 w-8 bg-white/90 hover:bg-white shadow-sm"
                disabled={isUploading}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => inputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                {hasImage ? "Trocar Imagem" : "Enviar Imagem"}
              </DropdownMenuItem>

              {showColorOption && (
                <DropdownMenuItem
                  onSelect={() => {
                    setTimeout(() => setShowColorPicker(true), 150);
                  }}
                >
                  <Palette className="h-4 w-4 mr-2" />
                  {colorPickerLabel}
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
                    Remover Fundo
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Color Picker Popover - rendered outside dropdown to avoid closing conflict */}
        {showColorOption && (
          <Dialog open={showColorPicker} onOpenChange={setShowColorPicker}>
            <DialogContent className="max-w-xs">
              <DialogHeader>
                <DialogTitle>Escolha uma cor</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {/* Preset Colors Grid */}
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      className={cn(
                        "w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110",
                        customColor === color
                          ? "border-gray-900 ring-2 ring-gray-900 ring-offset-1"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => setCustomColor(color)}
                    />
                  ))}
                </div>

                {/* Custom Color Input */}
                <div className="flex items-center gap-2">
                  <div
                    className="w-10 h-10 rounded-lg border shrink-0"
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

                <Button
                  className="w-full"
                  onClick={() => handleApplyColor(customColor)}
                >
                  Aplicar Cor
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {hint && (
        <p className="text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
}
