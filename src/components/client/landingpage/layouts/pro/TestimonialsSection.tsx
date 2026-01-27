import { Star, Quote } from "lucide-react";

interface Testimonial {
  id: string;
  quote: string;
  name: string;
  location: string;
}

interface TestimonialsSectionProps {
  testimonials: Testimonial[];
  primaryColor: string;
}

export function TestimonialsSection({ testimonials, primaryColor }: TestimonialsSectionProps) {
  if (!testimonials?.length) return null;
  
  return (
    <section className="py-20 px-6 bg-white">
      <div className="container max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">
            O Que Nossos Clientes Dizem
          </h2>
          <p className="text-lg text-slate-600">
            Depoimentos reais de clientes satisfeitos
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <article 
              key={testimonial.id}
              className="bg-slate-50 rounded-2xl p-8 relative"
            >
              {/* Quote icon */}
              <Quote 
                className="w-10 h-10 absolute top-6 right-6 opacity-10"
                style={{ color: primaryColor }}
              />
              
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star 
                    key={star} 
                    className="w-5 h-5 fill-amber-400 text-amber-400" 
                  />
                ))}
              </div>
              
              {/* Quote */}
              <blockquote className="text-slate-700 leading-relaxed mb-6 italic">
                "{testimonial.quote}"
              </blockquote>
              
              {/* Author */}
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
                  style={{ backgroundColor: primaryColor }}
                >
                  {testimonial.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{testimonial.name}</p>
                  <p className="text-sm text-slate-500">{testimonial.location}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
