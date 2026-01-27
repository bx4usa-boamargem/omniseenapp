import logoOmniseen from "@/assets/logo-omniseen.png";
import { cn } from "@/lib/utils";

interface OmniseenLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'sidebar';
  variant?: 'light' | 'dark';
  className?: string;
}

const sizeClasses = {
  sm: "h-8",
  md: "h-10",
  lg: "h-14",
  sidebar: "h-12 max-w-[56px]",
};

export function OmniseenLogo({ size = 'md', variant = 'light', className }: OmniseenLogoProps) {
  return (
    <img 
      src={logoOmniseen} 
      alt="OMNISEEN" 
      className={cn(
        sizeClasses[size], 
        "w-auto object-contain",
        // Apply invert filter for dark backgrounds (light variant = dark logo for light backgrounds)
        variant === 'dark' && "brightness-0 invert",
        className
      )}
    />
  );
}
