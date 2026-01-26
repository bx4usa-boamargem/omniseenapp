interface FooterCTAProps {
  brandName: string;
  phone: string;
  primaryColor: string;
}

export function FooterCTA({ brandName, phone, primaryColor }: FooterCTAProps) {
  return (
    <section 
      className="py-20 px-6 text-center text-white"
      style={{ backgroundColor: '#0f172a' }} // Deep slate
    >
      <div className="container max-w-4xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-black mb-8 tracking-tight italic uppercase">
          Ready to Start Your Project?
        </h2>
        <p className="text-xl text-slate-400 mb-12 font-medium">
          Join thousands of satisfied homeowners who trust {brandName || "our experts"} for their professional service needs.
        </p>
        
        <div className="flex flex-col items-center gap-6">
          <a 
            href={`tel:${phone}`}
            className="px-12 py-6 rounded-2xl font-black text-3xl shadow-2xl hover:scale-105 transition-transform"
            style={{ backgroundColor: primaryColor }}
          >
            Call {phone}
          </a>
          <span className="text-slate-500 font-bold uppercase tracking-widest">
            © {new Date().getFullYear()} {brandName} • All Rights Reserved
          </span>
        </div>
      </div>
    </section>
  );
}
