import { Phone, Shield, Clock, Award } from "lucide-react";

interface ProFooterCTAProps {
  data: {
    headline: string;
    phone: string;
    badges: string[];
  };
  primaryColor: string;
}

const BADGE_ICONS: Record<string, React.ReactNode> = {
  "garantia": <Shield className="w-5 h-5" />,
  "24h": <Clock className="w-5 h-5" />,
  "qualidade": <Award className="w-5 h-5" />,
};

function getBadgeIcon(badge: string) {
  const lowerBadge = badge.toLowerCase();
  for (const [key, icon] of Object.entries(BADGE_ICONS)) {
    if (lowerBadge.includes(key)) return icon;
  }
  return <Shield className="w-5 h-5" />;
}

export function ProFooterCTA({ data, primaryColor }: ProFooterCTAProps) {
  if (!data) return null;
  
  return (
    <section 
      className="py-20 px-6 text-white"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="container max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold mb-6">
          {data.headline}
        </h2>
        
        {/* Badges */}
        {data.badges?.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            {data.badges.map((badge, i) => (
              <div 
                key={i}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full text-sm font-medium backdrop-blur-sm"
              >
                {getBadgeIcon(badge)}
                {badge}
              </div>
            ))}
          </div>
        )}
        
        {/* CTA Button */}
        {data.phone && (
          <a 
            href={`tel:${data.phone.replace(/\D/g, '')}`}
            className="inline-flex items-center gap-3 px-10 py-6 bg-white text-lg font-bold rounded-xl shadow-2xl hover:scale-105 transition-transform"
            style={{ color: primaryColor }}
          >
            <Phone className="w-6 h-6" />
            Ligar Agora: {data.phone}
          </a>
        )}
        
        <p className="mt-8 text-white/80 text-sm">
          Atendimento rápido e profissional. Ligue agora!
        </p>
      </div>
    </section>
  );
}
