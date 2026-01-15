import { Link } from "react-router-dom";
import { ArrowLeft, Check, Zap, Target, Building2, Globe } from "lucide-react";
import { OmniseenLogoHeader } from "@/components/ui/OmniseenLogoHeader";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

const Services = () => {
  const currentYear = new Date().getFullYear();

  const plans = [
    {
      name: "Lite",
      price: "$37",
      description: "Para começar sua presença digital local",
      features: [
        "1 blog",
        "8 artigos/mês",
        "1 usuário",
        "1 território",
        "SEO básico automatizado",
        "Domínio customizado",
        "Suporte por email"
      ],
      icon: Zap,
      popular: false
    },
    {
      name: "Pro",
      price: "$97",
      description: "Para negócios em crescimento",
      features: [
        "1 blog",
        "20 artigos/mês",
        "5 usuários",
        "2 territórios",
        "10 buscas no Radar/mês",
        "Inteligência de mercado semanal",
        "Análise de concorrentes",
        "Suporte prioritário"
      ],
      icon: Target,
      popular: true
    },
    {
      name: "Business",
      price: "$147",
      description: "Para empresas e agências",
      features: [
        "5 blogs",
        "100 artigos/mês",
        "20 usuários",
        "10 territórios",
        "30 buscas no Radar/blog",
        "API de integração",
        "Gerente de conta dedicado",
        "Onboarding personalizado"
      ],
      icon: Building2,
      popular: false
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <OmniseenLogoHeader className="h-8" />
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Nossos Serviços
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Transforme seu negócio local em uma máquina de aquisição de clientes com inteligência artificial
          </p>
        </div>
      </section>

      {/* What We Offer */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">O que oferecemos</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="p-6 rounded-xl border bg-card">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Radar de Oportunidades</h3>
              <p className="text-muted-foreground">
                IA que monitora o mercado local e identifica oportunidades de conteúdo com alta intenção comercial.
              </p>
            </div>

            <div className="p-6 rounded-xl border bg-card">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Geração Automática</h3>
              <p className="text-muted-foreground">
                Artigos otimizados para SEO criados automaticamente, com imagens únicas e CTAs personalizados.
              </p>
            </div>

            <div className="p-6 rounded-xl border bg-card">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Blog Profissional</h3>
              <p className="text-muted-foreground">
                Portal público com sua marca, domínio customizado e design responsivo pronto para converter.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">Planos e Preços</h2>
          <p className="text-center text-muted-foreground mb-12">
            Todos os planos incluem 7 dias de teste gratuito
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div 
                key={plan.name}
                className={`relative p-6 rounded-xl border bg-card ${
                  plan.popular ? 'border-primary shadow-lg scale-105' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-sm font-medium rounded-full">
                    Mais Popular
                  </div>
                )}
                
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <plan.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                </div>

                <div className="mb-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>

                <p className="text-muted-foreground mb-6">{plan.description}</p>

                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/auth">
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    Começar Grátis
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Como Funciona</h2>
          
          <div className="max-w-3xl mx-auto">
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                  1
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Configure seu negócio</h3>
                  <p className="text-muted-foreground">
                    Informe seu nicho, região de atuação e serviços. A IA aprende sobre seu negócio em minutos.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                  2
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">IA monitora o mercado</h3>
                  <p className="text-muted-foreground">
                    O Radar de Oportunidades analisa tendências, concorrentes e demandas locais automaticamente.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                  3
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">Conteúdo é criado e publicado</h3>
                  <p className="text-muted-foreground">
                    Artigos otimizados são gerados e publicados no seu blog, atraindo clientes qualificados 24/7.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Pronto para dominar seu mercado local?
          </h2>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            Comece seu teste gratuito de 7 dias. Sem cartão de crédito.
          </p>
          <Link to="/auth">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Começar Agora
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {currentYear} OMNISEEN. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-6 text-sm">
              <Link to="/terms" className="text-muted-foreground hover:text-foreground">
                Termos de Uso
              </Link>
              <Link to="/privacy" className="text-muted-foreground hover:text-foreground">
                Política de Privacidade
              </Link>
              <Link to="/en/services" className="text-muted-foreground hover:text-foreground">
                English
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Services;
