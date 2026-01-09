import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

interface FieldHelperProps {
  text?: string;
  variant?: "default" | "optional" | "auto" | "info";
  className?: string;
  showIcon?: boolean;
}

const variantTexts: Record<string, string> = {
  default: "",
  optional: "Opcional. Se não preencher, o sistema usa um padrão inteligente.",
  auto: "O sistema já faz isso automaticamente para você.",
  info: "",
};

export function FieldHelper({ 
  text, 
  variant = "default", 
  className,
  showIcon = false 
}: FieldHelperProps) {
  const displayText = text || variantTexts[variant];
  
  if (!displayText) return null;

  return (
    <p className={cn(
      "text-xs text-muted-foreground flex items-center gap-1.5",
      className
    )}>
      {showIcon && <Info className="h-3 w-3 shrink-0" />}
      {displayText}
    </p>
  );
}
