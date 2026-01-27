import { Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProHeroSectionProps {
  data: {
    headline: string;
    subheadline: string;
    image_url?: string | null;
  };
  phone?: string;
  primaryColor: string;
}

export function ProHeroSection({ data, phone, primaryColor }: ProHeroSectionProps) {
  const hasImage = !!data.image_url;
  
  return (
    <section className="relative min-h-[600px] flex items-center overflow-hidden">
      {/* Background Image with Overlay */}
      {hasImage ? (
        <>
          <div className="absolute inset-0">
            <img 
              src={data.image_url!} 
              alt="" 
              className="w-full h-full object-cover"
              loading="eager"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/60 to-black/30" />
        </>
      ) : (
        <div 
          className="absolute inset-0" 
          style={{ 
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${primaryColor}dd 50%, ${primaryColor}aa 100%)` 
          }}
        />
      )}
      
      {/* Content */}
      <div className="relative z-10 container max-w-6xl mx-auto px-6 py-24">
        <div className="max-w-3xl">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
            {data.headline}
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-10 leading-relaxed max-w-2xl">
            {data.subheadline}
          </p>
          
          {phone && (
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href={`tel:${phone.replace(/\D/g, '')}`}
                className="inline-flex items-center justify-center gap-3 px-8 py-5 rounded-xl text-lg font-bold text-white shadow-2xl hover:scale-105 transition-transform"
                style={{ backgroundColor: primaryColor }}
              >
                <Phone className="w-6 h-6" />
                Ligar Agora: {phone}
              </a>
              <Button 
                variant="outline" 
                size="lg"
                className="h-auto py-5 px-8 text-lg font-semibold border-white/30 text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm"
              >
                Ver Serviços
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </div>
      
      {/* Decorative gradient at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
    </section>
  );
}
