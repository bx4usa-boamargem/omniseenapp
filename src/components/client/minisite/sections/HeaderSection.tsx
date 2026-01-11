import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Search, MousePointerClick } from "lucide-react";

interface HeaderSectionProps {
  showSearch: boolean;
  headerCtaText: string;
  headerCtaUrl: string;
  onShowSearchChange: (value: boolean) => void;
  onHeaderCtaTextChange: (value: string) => void;
  onHeaderCtaUrlChange: (value: string) => void;
}

export function HeaderSection({
  showSearch,
  headerCtaText,
  headerCtaUrl,
  onShowSearchChange,
  onHeaderCtaTextChange,
  onHeaderCtaUrlChange,
}: HeaderSectionProps) {
  return (
    <div className="space-y-6">
      {/* Show Search Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
        <div className="flex items-center gap-3">
          <Search className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">Campo de Busca</p>
            <p className="text-sm text-muted-foreground">
              Exibir barra de pesquisa no cabeçalho
            </p>
          </div>
        </div>
        <Switch
          checked={showSearch}
          onCheckedChange={onShowSearchChange}
        />
      </div>

      {/* Header CTA */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MousePointerClick className="h-4 w-4 text-muted-foreground" />
          <Label className="text-base font-medium">Botão CTA do Cabeçalho</Label>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm">Texto do Botão</Label>
            <Input
              placeholder="Ex: Fale Conosco"
              value={headerCtaText}
              onChange={(e) => onHeaderCtaTextChange(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-sm">Link do Botão</Label>
            <Input
              placeholder="Ex: https://wa.me/5511999999999"
              value={headerCtaUrl}
              onChange={(e) => onHeaderCtaUrlChange(e.target.value)}
            />
          </div>
        </div>
        
        <p className="text-xs text-muted-foreground">
          💡 Para WhatsApp, use: https://wa.me/5511999999999
        </p>
      </div>
    </div>
  );
}
