import { Shield, Award } from "lucide-react";

interface MaterialsSectionProps {
  data: {
    title: string;
    description: string;
    image_url?: string | null;
  };
  primaryColor: string;
}

export function MaterialsSection({ data, primaryColor }: MaterialsSectionProps) {
  if (!data) return null;
  
  return (
    <section className="py-20 px-6 bg-slate-50">
      <div className="container max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Content */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 text-green-700 font-semibold text-sm mb-6">
              <Shield className="w-4 h-4" />
              Qualidade Garantida
            </div>
            
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6">
              {data.title}
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed mb-8">
              {data.description}
            </p>
            
            {/* Trust badges */}
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-slate-200">
                <Award className="w-5 h-5 text-amber-500" />
                <span className="text-sm font-medium text-slate-700">Materiais Premium</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm border border-slate-200">
                <Shield className="w-5 h-5 text-green-500" />
                <span className="text-sm font-medium text-slate-700">Garantia de Qualidade</span>
              </div>
            </div>
          </div>
          
          {/* Image */}
          <div>
            {data.image_url ? (
              <div className="relative">
                <img 
                  src={data.image_url} 
                  alt={data.title}
                  className="w-full h-auto max-h-[450px] object-cover rounded-2xl shadow-xl"
                  loading="lazy"
                />
                <div 
                  className="absolute -z-10 -bottom-4 -left-4 w-full h-full rounded-2xl"
                  style={{ backgroundColor: `${primaryColor}15` }}
                />
              </div>
            ) : (
              <div 
                className="w-full h-[400px] rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}10` }}
              >
                <Award className="w-16 h-16 opacity-20" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
