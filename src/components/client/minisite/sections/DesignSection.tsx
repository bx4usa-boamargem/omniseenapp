import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeCard } from "../ui/ThemeCard";
import { Paintbrush } from "lucide-react";

interface DesignSectionProps {
  layoutTemplate: string;
  primaryColor: string;
  secondaryColor: string;
  onLayoutChange: (value: string) => void;
  onPrimaryColorChange: (value: string) => void;
  onSecondaryColorChange: (value: string) => void;
}

const LAYOUT_OPTIONS = [
  { 
    id: 'minimal', 
    name: 'Minimalista', 
    description: 'Limpo e focado no conteúdo',
  },
  { 
    id: 'modern', 
    name: 'Moderno', 
    description: 'Visual contemporâneo',
  },
  { 
    id: 'corporate', 
    name: 'Profissional', 
    description: 'Formal e confiável',
  },
];

export function DesignSection({
  layoutTemplate,
  primaryColor,
  secondaryColor,
  onLayoutChange,
  onPrimaryColorChange,
  onSecondaryColorChange,
}: DesignSectionProps) {
  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Paintbrush className="h-4 w-4" />
          Tema do Site
        </Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LAYOUT_OPTIONS.map((option) => (
            <ThemeCard
              key={option.id}
              id={option.id}
              name={option.name}
              description={option.description}
              selected={layoutTemplate === option.id}
              onClick={() => onLayoutChange(option.id)}
            />
          ))}
        </div>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Cor Primária</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => onPrimaryColorChange(e.target.value)}
              className="w-12 h-12 rounded-lg border cursor-pointer"
            />
            <Input
              value={primaryColor}
              onChange={(e) => onPrimaryColorChange(e.target.value)}
              className="font-mono"
              placeholder="#6366f1"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Cor Secundária</Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => onSecondaryColorChange(e.target.value)}
              className="w-12 h-12 rounded-lg border cursor-pointer"
            />
            <Input
              value={secondaryColor}
              onChange={(e) => onSecondaryColorChange(e.target.value)}
              className="font-mono"
              placeholder="#8b5cf6"
            />
          </div>
        </div>
      </div>

      {/* Color Preview */}
      <div className="p-4 rounded-xl border bg-muted/30">
        <p className="text-sm text-muted-foreground mb-3">Preview do gradiente</p>
        <div 
          className="h-16 rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`
          }}
        />
      </div>
    </div>
  );
}
