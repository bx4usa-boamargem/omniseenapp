import { LandingPageData } from "../types/landingPageTypes";
import { Building2, Target, Users, Trophy, Mail, Phone, MapPin, Clock } from "lucide-react";
import { ArticleContent } from "@/components/public/ArticleContent";

interface InstitutionalLayoutProps {
  pageData: any;
  primaryColor: string;
  isEditing?: boolean;
  onEditBlock?: (blockType: string, data: any) => void;
}

export function InstitutionalLayout({
  pageData,
  primaryColor,
  isEditing = false,
  onEditBlock,
}: InstitutionalLayoutProps) {
  console.log("[InstitutionalLayout] Rendering with template:", pageData.template);

  const brand = pageData.brand || {};
  const hero = pageData.hero || {};
  const about = pageData.about || {};
  const servicesAreas = pageData.services_areas || [];
  const cases = pageData.cases || [];
  const team = pageData.team || [];
  const contact = pageData.contact || {};
  const authorityContent = pageData.authority_content || "";

  return (
    <div className="w-full bg-white text-slate-900 font-sans selection:bg-blue-100 border border-slate-200">
      {/* Template Badge */}
      <div className="bg-slate-900 text-white text-[10px] px-2 py-1 uppercase tracking-widest font-bold">
        Institutional Template v1.0
      </div>

      {/* 1. Corporate Hero */}
      <section 
        className="relative min-h-[500px] flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden"
      >
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative z-10 container max-w-5xl mx-auto px-6 text-center">
          {/* Logo/Company Name */}
          <div className="mb-8">
            <Building2 className="w-16 h-16 mx-auto mb-4 opacity-80" />
            <h2 className="text-xl font-medium tracking-wide uppercase opacity-70">
              {brand.company_name || "Empresa"}
            </h2>
            {brand.founded_year && (
              <p className="text-sm opacity-50 mt-1">Desde {brand.founded_year}</p>
            )}
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6 leading-tight">
            {hero.headline || "Excelência em Resultados"}
          </h1>
          
          <p className="text-xl md:text-2xl opacity-80 max-w-3xl mx-auto mb-8 leading-relaxed">
            {hero.subheadline || brand.tagline || "Soluções corporativas de alto impacto para empresas que buscam excelência."}
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href={`tel:${contact.phone || brand.phone}`}
              className="px-8 py-4 rounded-lg font-bold text-lg transition-all shadow-xl hover:shadow-2xl"
              style={{ backgroundColor: primaryColor }}
            >
              <Phone className="inline-block w-5 h-5 mr-2 -mt-1" />
              Fale Conosco
            </a>
            <a
              href={`mailto:${contact.email}`}
              className="px-8 py-4 rounded-lg font-bold text-lg bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all"
            >
              <Mail className="inline-block w-5 h-5 mr-2 -mt-1" />
              Solicitar Proposta
            </a>
          </div>

          {/* City Tag */}
          {brand.city && (
            <p className="mt-8 text-sm opacity-60 flex items-center justify-center gap-2">
              <MapPin className="w-4 h-4" />
              {brand.city}
            </p>
          )}
        </div>
      </section>

      {/* 2. About Section - Mission, Vision, Values */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="container max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
              Sobre a Empresa
            </h2>
            <div className="w-24 h-1 mx-auto" style={{ backgroundColor: primaryColor }} />
          </div>

          {/* History */}
          {about.history && (
            <div className="max-w-3xl mx-auto mb-16 text-center">
              <p className="text-lg text-slate-700 leading-relaxed">
                {about.history}
              </p>
            </div>
          )}

          {/* Mission, Vision, Values Grid */}
          <div className="grid md:grid-cols-3 gap-8">
            {/* Mission */}
            {about.mission && (
              <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div 
                  className="w-14 h-14 rounded-lg flex items-center justify-center mb-6"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Target className="w-7 h-7" style={{ color: primaryColor }} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Missão</h3>
                <p className="text-slate-600 leading-relaxed">{about.mission}</p>
              </div>
            )}

            {/* Vision */}
            {about.vision && (
              <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div 
                  className="w-14 h-14 rounded-lg flex items-center justify-center mb-6"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Building2 className="w-7 h-7" style={{ color: primaryColor }} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Visão</h3>
                <p className="text-slate-600 leading-relaxed">{about.vision}</p>
              </div>
            )}

            {/* Values */}
            {about.values && about.values.length > 0 && (
              <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div 
                  className="w-14 h-14 rounded-lg flex items-center justify-center mb-6"
                  style={{ backgroundColor: `${primaryColor}15` }}
                >
                  <Trophy className="w-7 h-7" style={{ color: primaryColor }} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">Valores</h3>
                <ul className="text-slate-600 space-y-2">
                  {about.values.slice(0, 5).map((value: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                      {value}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 3. Services/Areas Grid */}
      {servicesAreas.length > 0 && (
        <section className="py-20 px-6 bg-white">
          <div className="container max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
                Áreas de Atuação
              </h2>
              <div className="w-24 h-1 mx-auto" style={{ backgroundColor: primaryColor }} />
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {servicesAreas.map((area: any, idx: number) => (
                <div 
                  key={idx}
                  className="p-6 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-lg transition-all group"
                >
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: `${primaryColor}15` }}
                  >
                    <Building2 className="w-6 h-6" style={{ color: primaryColor }} />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{area.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{area.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 4. Cases/Results */}
      {cases.length > 0 && (
        <section className="py-20 px-6 bg-slate-900 text-white">
          <div className="container max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black mb-4">
                Resultados Comprovados
              </h2>
              <div className="w-24 h-1 mx-auto" style={{ backgroundColor: primaryColor }} />
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {cases.map((caseItem: any, idx: number) => (
                <div 
                  key={idx}
                  className="bg-white/5 backdrop-blur-sm p-6 rounded-xl border border-white/10 hover:border-white/20 transition-all"
                >
                  <Trophy className="w-10 h-10 mb-4" style={{ color: primaryColor }} />
                  <h3 className="text-xl font-bold mb-2">{caseItem.title}</h3>
                  <p className="text-2xl font-black mb-2" style={{ color: primaryColor }}>
                    {caseItem.result}
                  </p>
                  {caseItem.client && (
                    <p className="text-sm opacity-60">Cliente: {caseItem.client}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. Team */}
      {team.length > 0 && (
        <section className="py-20 px-6 bg-slate-50">
          <div className="container max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
                Nossa Equipe
              </h2>
              <div className="w-24 h-1 mx-auto" style={{ backgroundColor: primaryColor }} />
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {team.map((member: any, idx: number) => (
                <div 
                  key={idx}
                  className="bg-white p-6 rounded-xl shadow-md border border-slate-100 text-center hover:shadow-lg transition-shadow"
                >
                  <div 
                    className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-slate-200"
                  >
                    <Users className="w-10 h-10 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{member.name}</h3>
                  <p className="text-sm text-slate-500">{member.role}</p>
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

      {/* 7. Contact Section */}
      <section className="py-20 px-6 bg-slate-900 text-white">
        <div className="container max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-black mb-4">
              Entre em Contato
            </h2>
            <div className="w-24 h-1 mx-auto" style={{ backgroundColor: primaryColor }} />
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Contact Info */}
            <div className="space-y-6">
              {(contact.phone || brand.phone) && (
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${primaryColor}20` }}
                  >
                    <Phone className="w-5 h-5" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="text-sm opacity-60">Telefone</p>
                    <a 
                      href={`tel:${contact.phone || brand.phone}`}
                      className="text-lg font-medium hover:underline"
                    >
                      {contact.phone || brand.phone}
                    </a>
                  </div>
                </div>
              )}

              {contact.email && (
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${primaryColor}20` }}
                  >
                    <Mail className="w-5 h-5" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="text-sm opacity-60">E-mail</p>
                    <a 
                      href={`mailto:${contact.email}`}
                      className="text-lg font-medium hover:underline"
                    >
                      {contact.email}
                    </a>
                  </div>
                </div>
              )}

              {contact.address && (
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${primaryColor}20` }}
                  >
                    <MapPin className="w-5 h-5" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="text-sm opacity-60">Endereço</p>
                    <p className="text-lg font-medium">{contact.address}</p>
                  </div>
                </div>
              )}

              {contact.hours && (
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${primaryColor}20` }}
                  >
                    <Clock className="w-5 h-5" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="text-sm opacity-60">Horário</p>
                    <p className="text-lg font-medium">{contact.hours}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Map Embed */}
            {contact.map_embed && (
              <div className="rounded-xl overflow-hidden border border-white/10">
                <iframe
                  src={contact.map_embed}
                  width="100%"
                  height="300"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-slate-950 text-white/60 text-center text-sm">
        <p>© {new Date().getFullYear()} {brand.company_name || "Empresa"}. Todos os direitos reservados.</p>
        {brand.city && <p className="mt-1">{brand.city}</p>}
      </footer>
    </div>
  );
}
