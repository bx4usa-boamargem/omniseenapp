import { LandingPageData } from "../types/landingPageTypes";
import { User, Award, BookOpen, Mic, Star, MessageSquare, Calendar, ArrowRight, Linkedin, Instagram, Youtube } from "lucide-react";
import { ArticleContent } from "@/components/public/ArticleContent";

interface SpecialistAuthorityLayoutProps {
  pageData: any;
  primaryColor: string;
  isEditing?: boolean;
  onEditBlock?: (blockType: string, data: any) => void;
}

export function SpecialistAuthorityLayout({
  pageData,
  primaryColor,
  isEditing = false,
  onEditBlock,
}: SpecialistAuthorityLayoutProps) {
  console.log("[SpecialistAuthorityLayout] Rendering with template:", pageData.template);

  const specialist = pageData.specialist || {};
  const hero = pageData.hero || {};
  const about = pageData.about || {};
  const methodology = pageData.methodology || {};
  const testimonials = pageData.testimonials || [];
  const media = pageData.media || [];
  const cta = pageData.cta || {};
  const authorityContent = pageData.authority_content || "";
  const social = pageData.social || {};

  return (
    <div className="w-full bg-white text-slate-900 font-sans selection:bg-amber-100 border border-slate-200">
      {/* Template Badge */}
      <div className="bg-amber-600 text-white text-[10px] px-2 py-1 uppercase tracking-widest font-bold">
        Specialist Authority Template v1.0
      </div>

      {/* 1. Authority Hero with Specialist Photo */}
      <section className="relative min-h-[600px] flex items-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10">
          <div className="absolute inset-0 bg-gradient-to-l from-amber-500/30 to-transparent" />
        </div>

        <div className="relative z-10 container max-w-6xl mx-auto px-6 py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Content */}
            <div>
              {/* Credentials Badge */}
              {specialist.credentials && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
                  <Award className="w-4 h-4" style={{ color: primaryColor }} />
                  <span className="text-sm font-medium">{specialist.credentials}</span>
                </div>
              )}

              {/* Headline */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6 leading-tight">
                {hero.headline || specialist.name || "Especialista"}
              </h1>
              
              <p className="text-xl md:text-2xl opacity-80 mb-4">
                {specialist.title || hero.subheadline}
              </p>

              {hero.tagline && (
                <p className="text-lg opacity-60 mb-8 italic">
                  "{hero.tagline}"
                </p>
              )}

              {/* CTA Button */}
              <a
                href={cta.action_url || "#contact"}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:scale-105"
                style={{ backgroundColor: primaryColor }}
              >
                <Calendar className="w-5 h-5" />
                {cta.action_text || "Agende uma Consulta"}
                <ArrowRight className="w-5 h-5" />
              </a>

              {/* Social Links */}
              <div className="flex gap-4 mt-8">
                {social.linkedin && (
                  <a href={social.linkedin} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity">
                    <Linkedin className="w-6 h-6" />
                  </a>
                )}
                {social.instagram && (
                  <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity">
                    <Instagram className="w-6 h-6" />
                  </a>
                )}
                {social.youtube && (
                  <a href={social.youtube} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100 transition-opacity">
                    <Youtube className="w-6 h-6" />
                  </a>
                )}
              </div>
            </div>

            {/* Right: Photo Placeholder */}
            <div className="hidden lg:flex justify-center">
              <div 
                className="w-80 h-96 rounded-2xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-2xl"
              >
                <div className="text-center">
                  <User className="w-24 h-24 mx-auto opacity-40" />
                  <p className="text-sm opacity-40 mt-4">Foto do Especialista</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. About/Bio Section */}
      <section className="py-20 px-6 bg-white">
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
              Quem Sou
            </h2>
            <div className="w-24 h-1 mx-auto" style={{ backgroundColor: primaryColor }} />
          </div>

          <div className="prose prose-slate prose-lg max-w-none text-center">
            <p className="text-xl text-slate-700 leading-relaxed mb-8">
              {about.bio || "Especialista com ampla experiência na área."}
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-12">
            {about.experience_years && (
              <div className="text-center p-6 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-4xl font-black" style={{ color: primaryColor }}>
                  {about.experience_years}+
                </p>
                <p className="text-sm text-slate-600 mt-1">Anos de Experiência</p>
              </div>
            )}
            {about.clients_count && (
              <div className="text-center p-6 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-4xl font-black" style={{ color: primaryColor }}>
                  {about.clients_count}+
                </p>
                <p className="text-sm text-slate-600 mt-1">Clientes Atendidos</p>
              </div>
            )}
            {about.courses_count && (
              <div className="text-center p-6 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-4xl font-black" style={{ color: primaryColor }}>
                  {about.courses_count}+
                </p>
                <p className="text-sm text-slate-600 mt-1">Cursos Ministrados</p>
              </div>
            )}
            {about.articles_count && (
              <div className="text-center p-6 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-4xl font-black" style={{ color: primaryColor }}>
                  {about.articles_count}+
                </p>
                <p className="text-sm text-slate-600 mt-1">Artigos Publicados</p>
              </div>
            )}
          </div>

          {/* Specializations */}
          {about.specializations && about.specializations.length > 0 && (
            <div className="mt-12 text-center">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Especializações</h3>
              <div className="flex flex-wrap justify-center gap-3">
                {about.specializations.map((spec: string, idx: number) => (
                  <span 
                    key={idx}
                    className="px-4 py-2 rounded-full text-sm font-medium border"
                    style={{ 
                      borderColor: primaryColor,
                      color: primaryColor,
                      backgroundColor: `${primaryColor}10`
                    }}
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 3. Methodology Section */}
      {methodology.name && (
        <section className="py-20 px-6 bg-slate-50">
          <div className="container max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span 
                className="inline-block px-4 py-1 rounded-full text-sm font-medium mb-4"
                style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
              >
                Metodologia Exclusiva
              </span>
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
                {methodology.name}
              </h2>
              {methodology.unique_selling_point && (
                <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                  {methodology.unique_selling_point}
                </p>
              )}
            </div>

            {/* Steps */}
            {methodology.steps && methodology.steps.length > 0 && (
              <div className="grid md:grid-cols-3 gap-8 mt-12">
                {methodology.steps.map((step: any, idx: number) => (
                  <div key={idx} className="relative">
                    {/* Step Number */}
                    <div 
                      className="absolute -top-4 -left-4 w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-xl shadow-lg"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {idx + 1}
                    </div>
                    <div className="bg-white p-8 pt-10 rounded-xl shadow-md border border-slate-100">
                      <h3 className="text-xl font-bold text-slate-900 mb-3">
                        {step.title || step}
                      </h3>
                      {step.description && (
                        <p className="text-slate-600">{step.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* 4. Testimonials */}
      {testimonials.length > 0 && (
        <section className="py-20 px-6 bg-white">
          <div className="container max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
                O Que Dizem os Clientes
              </h2>
              <div className="w-24 h-1 mx-auto" style={{ backgroundColor: primaryColor }} />
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {testimonials.map((testimonial: any, idx: number) => (
                <div 
                  key={idx}
                  className="p-8 rounded-xl bg-slate-50 border border-slate-100 relative"
                >
                  <MessageSquare 
                    className="absolute top-4 right-4 w-10 h-10 opacity-10" 
                    style={{ color: primaryColor }}
                  />
                  
                  {/* Stars */}
                  <div className="flex gap-1 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className="w-5 h-5" 
                        style={{ color: primaryColor, fill: primaryColor }}
                      />
                    ))}
                  </div>

                  <blockquote className="text-lg text-slate-700 italic mb-6 leading-relaxed">
                    "{testimonial.quote}"
                  </blockquote>

                  <div>
                    <p className="font-bold text-slate-900">{testimonial.name}</p>
                    {testimonial.context && (
                      <p className="text-sm text-slate-500">{testimonial.context}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. Media/Publications */}
      {media.length > 0 && (
        <section className="py-20 px-6 bg-slate-900 text-white">
          <div className="container max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-black mb-4">
                Na Mídia
              </h2>
              <div className="w-24 h-1 mx-auto" style={{ backgroundColor: primaryColor }} />
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {media.map((item: any, idx: number) => (
                <div 
                  key={idx}
                  className="p-6 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-3 mb-4">
                    {item.type === 'podcast' && <Mic className="w-6 h-6" style={{ color: primaryColor }} />}
                    {item.type === 'article' && <BookOpen className="w-6 h-6" style={{ color: primaryColor }} />}
                    {item.type === 'video' && <Youtube className="w-6 h-6" style={{ color: primaryColor }} />}
                    {!item.type && <BookOpen className="w-6 h-6" style={{ color: primaryColor }} />}
                    <span className="text-sm opacity-60 uppercase">{item.type || 'Publicação'}</span>
                  </div>
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                  {item.source && (
                    <p className="text-sm opacity-60">{item.source}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 6. Authority Content (SEO Block) */}
      {authorityContent && (
        <section className="py-24 px-6 bg-white border-y border-slate-200">
          <div className="container max-w-4xl mx-auto">
            <div className="prose prose-slate prose-lg max-w-none 
              prose-headings:font-black prose-headings:tracking-tight prose-headings:text-slate-950
              prose-h2:text-3xl prose-h2:border-b-2 prose-h2:pb-4 prose-h2:mb-8
              prose-p:text-slate-700 prose-p:leading-relaxed">
              <ArticleContent content={typeof authorityContent === 'string' ? authorityContent : (authorityContent.html || "")} />
            </div>
          </div>
        </section>
      )}

      {/* 7. CTA Section */}
      <section 
        className="py-20 px-6 text-white"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="container max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-4">
            {cta.headline || "Pronto para Transformar Sua Vida?"}
          </h2>
          <p className="text-xl opacity-90 mb-8">
            {cta.description || "Agende uma sessão e descubra como posso ajudar você a alcançar seus objetivos."}
          </p>
          <a
            href={cta.action_url || "#contact"}
            className="inline-flex items-center gap-2 px-10 py-5 rounded-lg font-bold text-lg bg-white transition-all shadow-xl hover:shadow-2xl hover:scale-105"
            style={{ color: primaryColor }}
          >
            <Calendar className="w-5 h-5" />
            {cta.action_text || "Agendar Consulta"}
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-slate-950 text-white/60 text-center text-sm">
        <p>© {new Date().getFullYear()} {specialist.name || "Especialista"}. Todos os direitos reservados.</p>
        <div className="flex justify-center gap-4 mt-4">
          {social.linkedin && (
            <a href={social.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              <Linkedin className="w-5 h-5" />
            </a>
          )}
          {social.instagram && (
            <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              <Instagram className="w-5 h-5" />
            </a>
          )}
          {social.youtube && (
            <a href={social.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              <Youtube className="w-5 h-5" />
            </a>
          )}
        </div>
      </footer>
    </div>
  );
}
