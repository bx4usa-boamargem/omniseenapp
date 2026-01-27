import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface ProFAQSectionProps {
  faqs: FAQItem[];
  primaryColor: string;
}

export function ProFAQSection({ faqs, primaryColor }: ProFAQSectionProps) {
  const [openId, setOpenId] = useState<string | null>(faqs?.[0]?.id || null);
  
  if (!faqs?.length) return null;
  
  return (
    <section className="py-20 px-6 bg-slate-50">
      <div className="container max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <div 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-6"
            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
          >
            <HelpCircle className="w-4 h-4" />
            Perguntas Frequentes
          </div>
          
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900">
            Dúvidas Comuns
          </h2>
        </div>
        
        {/* FAQ Accordion */}
        <div className="space-y-4">
          {faqs.map((faq) => {
            const isOpen = openId === faq.id;
            
            return (
              <div 
                key={faq.id}
                className={cn(
                  "bg-white rounded-xl border overflow-hidden transition-all",
                  isOpen ? "border-slate-300 shadow-md" : "border-slate-200"
                )}
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : faq.id)}
                  className="w-full flex items-center justify-between p-6 text-left"
                >
                  <h3 className="text-lg font-semibold text-slate-900 pr-4">
                    {faq.question}
                  </h3>
                  <ChevronDown 
                    className={cn(
                      "w-5 h-5 flex-shrink-0 transition-transform duration-200",
                      isOpen ? "rotate-180" : ""
                    )}
                    style={{ color: primaryColor }}
                  />
                </button>
                
                <div 
                  className={cn(
                    "overflow-hidden transition-all duration-200",
                    isOpen ? "max-h-[500px]" : "max-h-0"
                  )}
                >
                  <div className="px-6 pb-6 pt-0">
                    <p className="text-slate-600 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
