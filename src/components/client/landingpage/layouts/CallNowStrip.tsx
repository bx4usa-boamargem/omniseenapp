interface CallNowStripProps {
  phone: string;
  primaryColor: string;
}

export function CallNowStrip({ phone, primaryColor }: CallNowStripProps) {
  if (!phone) return null;

  return (
    <div 
      className="sticky top-0 z-50 py-4 px-6 shadow-xl flex items-center justify-center gap-8"
      style={{ backgroundColor: primaryColor }}
    >
      <span className="text-white font-black text-2xl md:text-3xl tracking-tighter uppercase italic">
        Need Help Fast?
      </span>
      <a 
        href={`tel:${phone}`}
        className="bg-white text-slate-950 px-8 py-2 rounded-full font-black text-xl md:text-2xl hover:scale-105 transition-transform"
      >
        Call Now: {phone}
      </a>
    </div>
  );
}
