import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

interface ColorPaletteDisplayProps {
  primaryColor: string;
  secondaryColor: string;
}

interface ColorChipProps {
  color: string;
  label: string;
}

function ColorChip({ color, label }: ColorChipProps) {
  const [copied, setCopied] = useState(false);

  const copyColor = () => {
    navigator.clipboard.writeText(color);
    setCopied(true);
    toast.success(`Cor ${color} copiada!`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copyColor}
      className="group flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
      title={`Copiar ${color}`}
    >
      <div
        className="w-8 h-8 rounded-lg border border-border shadow-sm"
        style={{ backgroundColor: color }}
      />
      <div className="text-left">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-mono font-medium">{color}</p>
      </div>
      <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </button>
  );
}

export function ColorPaletteDisplay({ primaryColor, secondaryColor }: ColorPaletteDisplayProps) {
  // Generate a simple palette preview
  const generateShade = (color: string, factor: number): string => {
    // Simple shade generation (for visual preview only)
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    const adjust = (value: number) => Math.round(Math.min(255, Math.max(0, value * factor)));
    
    return `#${adjust(r).toString(16).padStart(2, '0')}${adjust(g).toString(16).padStart(2, '0')}${adjust(b).toString(16).padStart(2, '0')}`;
  };

  const shades = [
    { factor: 1.4, label: '100' },
    { factor: 1.2, label: '300' },
    { factor: 1.0, label: '500' },
    { factor: 0.8, label: '700' },
    { factor: 0.6, label: '900' },
  ];

  return (
    <div className="space-y-4">
      {/* Main colors */}
      <div className="grid grid-cols-2 gap-2">
        <ColorChip color={primaryColor} label="Primária" />
        <ColorChip color={secondaryColor} label="Secundária" />
      </div>

      {/* Palette preview */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">Paleta gerada</p>
        <div className="flex gap-1 rounded-lg overflow-hidden">
          {shades.map((shade) => (
            <div
              key={shade.label}
              className="flex-1 h-8 first:rounded-l-lg last:rounded-r-lg"
              style={{ backgroundColor: generateShade(primaryColor, shade.factor) }}
              title={`${shade.label}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
