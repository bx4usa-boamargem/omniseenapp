import { MapPin, CheckCircle } from "lucide-react";

interface AreasServedSectionProps {
  data: {
    title: string;
    intro: string;
    neighborhoods: string[];
  };
  primaryColor: string;
}

export function AreasServedSection({ data, primaryColor }: AreasServedSectionProps) {
  if (!data || !data.neighborhoods?.length) return null;
  
  return (
    <section className="py-20 px-6 bg-white">
      <div className="container max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6"
            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
          >
            <MapPin className="w-4 h-4" />
            Cobertura Completa
          </div>
          
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
            {data.title}
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            {data.intro}
          </p>
        </div>
        
        {/* Neighborhoods grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {data.neighborhoods.map((neighborhood, i) => (
            <div 
              key={i}
              className="flex items-center gap-2 px-4 py-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-200 transition-colors"
            >
              <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: primaryColor }} />
              <span className="text-slate-700 text-sm font-medium truncate">{neighborhood}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
