import { AlertTriangle, Phone } from "lucide-react";

interface ProEmergencyBannerProps {
  data: {
    headline: string;
    subtext: string;
  };
  phone?: string;
  primaryColor: string;
}

export function ProEmergencyBanner({ data, phone, primaryColor }: ProEmergencyBannerProps) {
  if (!data) return null;
  
  return (
    <section 
      className="py-8 px-6"
      style={{ backgroundColor: '#dc2626' }}  // Red for emergency
    >
      <div className="container max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4 text-white">
            <div className="p-3 bg-white/20 rounded-full">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold">{data.headline}</h3>
              <p className="text-white/90">{data.subtext}</p>
            </div>
          </div>
          
          {phone && (
            <a 
              href={`tel:${phone.replace(/\D/g, '')}`}
              className="inline-flex items-center gap-3 px-8 py-4 bg-white text-red-600 font-bold rounded-xl shadow-lg hover:scale-105 transition-transform whitespace-nowrap"
            >
              <Phone className="w-5 h-5" />
              {phone}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
