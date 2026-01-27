import { Button } from "@/components/ui/button";

interface ServiceCardGridProps {
  services: any[];
  primaryColor: string;
  isEditing?: boolean;
  onEdit?: (index: number, field: string, value: string) => void;
}

export function ServiceCardGrid({ services, primaryColor, isEditing, onEdit }: ServiceCardGridProps) {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="container max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight uppercase italic">
            Nossos Serviços Especializados
          </h2>
          <div className="w-24 h-2 mx-auto rounded-full" style={{ backgroundColor: primaryColor }} />
        </div>

        <div className="grid md:grid-cols-3 gap-10">
          {services.map((service: any, index: number) => (
            <div 
              key={index}
              className="flex flex-col bg-white border-2 border-slate-100 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group"
            >
              {/* Imagem do Serviço - FOTOREALISTA */}
              <div className="h-64 overflow-hidden relative">
                {service.image_url ? (
                  <img 
                    src={service.image_url} 
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 animate-pulse flex items-center justify-center">
                    <span className="text-slate-400 text-xs font-bold uppercase">Gerando Foto Real...</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
                <h3 className="absolute bottom-6 left-6 text-2xl font-black text-white uppercase tracking-tighter">
                  {service.title}
                </h3>
              </div>

              <div className="p-8 flex flex-col flex-1">
                <p className="text-slate-600 mb-8 leading-relaxed font-medium flex-1">
                  {service.desc}
                </p>
                
                <Button 
                  className="w-full h-14 rounded-xl font-black text-lg uppercase tracking-tight shadow-md hover:shadow-xl transition-all"
                  style={{ backgroundColor: primaryColor }}
                >
                  {service.cta || "Solicitar Agora"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}