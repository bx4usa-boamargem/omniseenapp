import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroSection } from "../types/landingPageTypes";
import { buildSimpleWhatsAppLink } from "@/lib/whatsappBuilder";

interface HeroBlockProps {
  data: HeroSection;
  whatsapp?: string;
  primaryColor?: string;
  companyName?: string;
  onEdit?: (field: keyof HeroSection, value: string) => void;
  isEditing?: boolean;
}

export function HeroBlock({ 
  data, 
  whatsapp, 
  primaryColor = "hsl(var(--primary))",
  companyName,
  onEdit,
  isEditing = false 
}: HeroBlockProps) {
  return (
    <div className="relative py-20 px-4 bg-muted/20 border-b border-border">
      <div className="container max-w-5xl mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold text-foreground mb-6 leading-tight">
          {data.title}
        </h1>
        <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto">
          {data.subtitle}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={`tel:${data.phone || ''}`}
            className="w-full sm:w-auto px-10 py-5 bg-primary text-primary-foreground rounded-xl font-black text-2xl shadow-xl hover:scale-105 transition-transform"
            style={{ backgroundColor: primaryColor }}
          >
            Call Now: {data.phone || 'Ligar Agora'}
          </a>
        </div>
      </div>
    </div>
  );
}