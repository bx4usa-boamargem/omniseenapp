import { CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeepDiveSectionProps {
  data: {
    id: string;
    title: string;
    intro: string;
    hero_image_url?: string | null;
    side_image_url?: string | null;
    bullets: string[];
    cta_text: string;
  };
  reverse?: boolean;
  phone?: string;
  primaryColor: string;
}

export function DeepDiveSection({ data, reverse = false, phone, primaryColor }: DeepDiveSectionProps) {
  return (
    <section className="py-20 px-6 bg-white">
      {/* Hero Image Fullwidth */}
      {data.hero_image_url && (
        <div className="w-full max-w-7xl mx-auto mb-16 overflow-hidden rounded-2xl">
          <div className="aspect-[21/9] relative">
            <img 
              src={data.hero_image_url} 
              alt={data.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        </div>
      )}
      
      <div className="container max-w-6xl mx-auto">
        <div className={`grid lg:grid-cols-2 gap-12 lg:gap-16 items-center ${reverse ? 'lg:grid-flow-col-dense' : ''}`}>
          {/* Side Image */}
          <div className={reverse ? 'lg:col-start-2' : ''}>
            {data.side_image_url ? (
              <div className="relative">
                <img 
                  src={data.side_image_url} 
                  alt={data.title}
                  className="w-full h-auto max-h-[500px] object-cover rounded-2xl shadow-xl"
                  loading="lazy"
                />
                {/* Decorative element */}
                <div 
                  className="absolute -z-10 -bottom-4 -right-4 w-full h-full rounded-2xl"
                  style={{ backgroundColor: `${primaryColor}20` }}
                />
              </div>
            ) : (
              <div 
                className="w-full h-[400px] rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}10` }}
              >
                <span className="text-6xl opacity-20">📷</span>
              </div>
            )}
          </div>
          
          {/* Content */}
          <div className={reverse ? 'lg:col-start-1' : ''}>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6">
              {data.title}
            </h2>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              {data.intro}
            </p>
            
            {/* Bullets */}
            <ul className="space-y-4 mb-10">
              {data.bullets?.map((bullet, i) => (
                <li key={i} className="flex items-start gap-4">
                  <CheckCircle 
                    className="w-6 h-6 flex-shrink-0 mt-0.5" 
                    style={{ color: primaryColor }} 
                  />
                  <span className="text-slate-700">{bullet}</span>
                </li>
              ))}
            </ul>
            
            {/* CTA */}
            {phone ? (
              <a 
                href={`tel:${phone.replace(/\D/g, '')}`}
                className="inline-flex items-center gap-3 px-8 py-4 rounded-xl text-lg font-bold text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                style={{ backgroundColor: primaryColor }}
              >
                {data.cta_text || "Solicitar Orçamento"}
                <ArrowRight className="w-5 h-5" />
              </a>
            ) : (
              <Button 
                size="lg" 
                className="h-14 px-8 text-lg font-semibold"
                style={{ backgroundColor: primaryColor }}
              >
                {data.cta_text || "Solicitar Orçamento"}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
