import { MapPin } from "lucide-react";

interface Challenge {
  id: string;
  title: string;
  description: string;
  image_url?: string | null;
}

interface LocalContextSectionProps {
  data: {
    title: string;
    intro: string;
    hero_image_url?: string | null;
    challenges: Challenge[];
  };
  primaryColor: string;
}

export function LocalContextSection({ data, primaryColor }: LocalContextSectionProps) {
  if (!data) return null;
  
  return (
    <section className="py-20 px-6 bg-slate-50">
      {/* Hero Image */}
      {data.hero_image_url && (
        <div className="w-full max-w-7xl mx-auto mb-16 overflow-hidden rounded-2xl">
          <div className="aspect-[21/9] relative">
            <img 
              src={data.hero_image_url} 
              alt={data.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-8">
              <div className="flex items-center gap-3 text-white">
                <MapPin className="w-6 h-6" />
                <span className="text-xl font-semibold">Contexto Local</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="container max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-6">
            {data.title}
          </h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            {data.intro}
          </p>
        </div>
        
        {/* Challenge Cards (3 with images) */}
        <div className="grid md:grid-cols-3 gap-8">
          {data.challenges?.map((challenge) => (
            <article 
              key={challenge.id} 
              className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
            >
              {/* Image */}
              <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                {challenge.image_url ? (
                  <img 
                    src={challenge.image_url} 
                    alt={challenge.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center"
                    style={{ backgroundColor: `${primaryColor}10` }}
                  >
                    <MapPin className="w-12 h-12 opacity-20" />
                  </div>
                )}
              </div>
              
              {/* Content */}
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {challenge.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {challenge.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
