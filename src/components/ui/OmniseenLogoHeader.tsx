import logoOmniseen from "@/assets/logo-omniseen.png";
import { cn } from "@/lib/utils";

interface OmniseenLogoHeaderProps {
  className?: string;
  variant?: "dark" | "light";
}

export function OmniseenLogoHeader({ className, variant = "dark" }: OmniseenLogoHeaderProps) {
  return (
    <img 
      src={logoOmniseen} 
      alt="Omniseen" 
      className={cn(
        "h-8 w-auto object-contain",
        // Aplicar filtro de inversão para tema light (fundos escuros como footer)
        variant === "light" && "brightness-0 invert",
        className
      )}
    />
  );
}
