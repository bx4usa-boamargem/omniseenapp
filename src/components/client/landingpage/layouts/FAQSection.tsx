interface FAQSectionProps {
  faqs: any[];
  primaryColor: string;
}

export function FAQSection({ faqs, primaryColor }: FAQSectionProps) {
  if (!faqs || faqs.length === 0) return null;

  return (
    <section className="py-24 px-6 bg-white">
      <div className="container max-w-4xl mx-auto">
        <h2 className="text-4xl font-black text-slate-900 mb-12 text-center tracking-tight">
          Frequently Asked Questions
        </h2>
        
        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-slate-50 rounded-2xl p-8 border border-slate-100">
              <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">
                {faq.question}
              </h3>
              <p className="text-slate-600 leading-relaxed font-medium">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
