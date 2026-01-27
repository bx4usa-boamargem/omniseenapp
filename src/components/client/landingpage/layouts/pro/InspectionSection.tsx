import { CheckCircle, Gift } from "lucide-react";

interface InspectionSectionProps {
  data: {
    title: string;
    intro: string;
    steps: string[];
    image_url?: string | null;
    special_offer?: string;
  };
  primaryColor: string;
}

export function InspectionSection({ data, primaryColor }: InspectionSectionProps) {
  if (!data) return null;
  
  return (
    <section className="py-20 px-6 bg-white">
      <div className="container max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Image */}
          <div className="order-2 lg:order-1">
            {data.image_url ? (
              <div className="relative">
                <img 
                  src={data.image_url} 
                  alt={data.title}
                  className="w-full h-auto max-h-[500px] object-cover rounded-2xl shadow-xl"
                  loading="lazy"
                />
                {/* Badge */}
                {data.special_offer && (
                  <div 
                    className="absolute -top-4 -right-4 px-4 py-2 rounded-full text-white font-bold text-sm shadow-lg flex items-center gap-2"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Gift className="w-4 h-4" />
                    {data.special_offer}
                  </div>
                )}
              </div>
            ) : (
              <div 
                className="w-full h-[400px] rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${primaryColor}10` }}
              >
                <span className="text-6xl opacity-20">🔍</span>
              </div>
            )}
          </div>
          
          {/* Content */}
          <div className="order-1 lg:order-2">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6">
              {data.title}
            </h2>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              {data.intro}
            </p>
            
            {/* Steps */}
            <ol className="space-y-4">
              {data.steps?.map((step, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {i + 1}
                  </div>
                  <span className="text-slate-700 pt-1">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
