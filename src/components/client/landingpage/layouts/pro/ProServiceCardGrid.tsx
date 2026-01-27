import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface ServiceCard {
  id: string;
  title: string;
  description: string;
  cta_text: string;
  image_url?: string | null;
}

interface ProServiceCardGridProps {
  cards: ServiceCard[];
  phone?: string;
  primaryColor: string;
}

export function ProServiceCardGrid({ cards, phone, primaryColor }: ProServiceCardGridProps) {
  if (!cards?.length) return null;
  
  return (
    <section className="py-20 px-6 bg-slate-50">
      <div className="container max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
            Nossos Serviços Especializados
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Soluções completas para atender suas necessidades com qualidade e profissionalismo
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {cards.map((card) => (
            <article 
              key={card.id} 
              className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col"
            >
              {/* Image */}
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                {card.image_url ? (
                  <img 
                    src={card.image_url} 
                    alt={card.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <span className="text-4xl opacity-30">📷</span>
                  </div>
                )}
              </div>
              
              {/* Content */}
              <div className="p-6 flex flex-col flex-1">
                <h3 className="text-xl font-bold text-slate-900 mb-3 line-clamp-2">
                  {card.title}
                </h3>
                <p className="text-slate-600 mb-4 line-clamp-3 flex-1">
                  {card.description}
                </p>
                
                {phone ? (
                  <a 
                    href={`tel:${phone.replace(/\D/g, '')}`}
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-white font-semibold transition-colors"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {card.cta_text || "Solicitar Orçamento"}
                    <ArrowRight className="w-4 h-4" />
                  </a>
                ) : (
                  <Button 
                    className="w-full" 
                    style={{ backgroundColor: primaryColor }}
                  >
                    {card.cta_text || "Saiba Mais"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
