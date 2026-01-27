import { Phone, MessageCircle } from "lucide-react";

interface ProCallStripProps {
  phone: string;
  primaryColor: string;
}

export function ProCallStrip({ phone, primaryColor }: ProCallStripProps) {
  if (!phone) return null;
  
  return (
    <div 
      className="py-4 px-6"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="container max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8">
        <a 
          href={`tel:${phone.replace(/\D/g, '')}`}
          className="inline-flex items-center gap-2 text-white font-semibold hover:underline"
        >
          <Phone className="w-5 h-5" />
          Ligue Agora: {phone}
        </a>
        
        <span className="hidden sm:inline text-white/50">|</span>
        
        <a 
          href={`https://wa.me/55${phone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-white font-semibold hover:underline"
        >
          <MessageCircle className="w-5 h-5" />
          WhatsApp
        </a>
      </div>
    </div>
  );
}
