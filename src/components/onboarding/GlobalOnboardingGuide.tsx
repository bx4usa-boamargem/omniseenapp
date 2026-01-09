import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

export interface OnboardingStep {
  title: string;
  description: string;
  element?: string; // CSS selector for highlighting (optional)
  icon?: React.ReactNode;
}

interface GlobalOnboardingGuideProps {
  steps: OnboardingStep[];
  title: string;
  onComplete: () => void;
  onSkip: () => void;
}

export function GlobalOnboardingGuide({
  steps,
  title,
  onComplete,
  onSkip,
}: GlobalOnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const progress = ((currentStep + 1) / steps.length) * 100;
  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md mx-4 shadow-2xl border-primary/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg gradient-primary">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <CardTitle className="text-lg">{title}</CardTitle>
            </div>
            <Button variant="ghost" size="icon" onClick={onSkip} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Passo {currentStep + 1} de {steps.length}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              {step.icon && (
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                  {step.icon}
                </div>
              )}
              <div>
                <h3 className="font-semibold text-base">{step.title}</h3>
                <CardDescription className="text-sm mt-1">{step.description}</CardDescription>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>

            <Button size="sm" onClick={handleNext} className="gap-1">
              {isLastStep ? (
                "Concluir"
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>

          <button
            onClick={onSkip}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Pular tour e explorar sozinho
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

// Predefined step configurations for each page
export const ONBOARDING_STEPS: Record<string, OnboardingStep[]> = {
  dashboard: [
    {
      title: "Cards de Estatísticas",
      description: "Aqui você vê um resumo rápido do seu blog: total de artigos, publicados, rascunhos e visualizações totais.",
    },
    {
      title: "Criar Novo Post",
      description: "Escolha como criar seu próximo artigo: use sugestão da IA, palavra-chave específica, documento PDF ou estratégia de cluster SEO.",
    },
    {
      title: "Widget de Analytics",
      description: "Acompanhe o engajamento dos seus leitores nos últimos 7 dias: visitantes, taxa de leitura completa e cliques em CTAs.",
    },
    {
      title: "Preview do Blog",
      description: "Veja como seu blog público está aparecendo para os visitantes. Clique para acessá-lo diretamente.",
    },
    {
      title: "Menu Lateral",
      description: "Use o menu à esquerda para navegar entre as seções da plataforma: artigos, analytics, estratégia, configurações e mais.",
    },
  ],
  analytics: [
    {
      title: "Cards de Métricas",
      description: "Visão geral rápida: artigos publicados, total de visualizações, tempo médio de leitura e taxa de leitura completa.",
    },
    {
      title: "Seletor de Período",
      description: "Filtre os dados por período: últimos 7, 30 ou 90 dias para analisar diferentes janelas de tempo.",
    },
    {
      title: "Gráfico de Visualizações",
      description: "Acompanhe a evolução do tráfego ao longo do tempo. Identifique picos e tendências.",
    },
    {
      title: "Fontes de Tráfego",
      description: "Descubra de onde vêm seus visitantes: busca orgânica (Google), redes sociais, direto, email ou referências.",
    },
    {
      title: "Abas Funil e Heatmap",
      description: "Análises avançadas: veja como leitores progridem pelo funil de conversão e quais seções mais engajam.",
    },
  ],
  strategy: [
    {
      title: "Estratégia Universal",
      description: "Preencha apenas esta aba para configurar seu blog. A IA usará essas informações para gerar artigos personalizados de alta qualidade.",
    },
    {
      title: "Blog Configurado!",
      description: "Após salvar sua estratégia, você pode gerar artigos ilimitados sem precisar preencher mais nada.",
    },
    {
      title: "Abas Avançadas (Opcionais)",
      description: "Meu Negócio, Biblioteca, Público-alvo, Concorrentes e Palavras-chave são opcionais para refinamento extra.",
    },
  ],
  articles: [
    {
      title: "Filtros por Status",
      description: "Filtre artigos por status: Todos, Publicados, Rascunhos ou Em Revisão pelo cliente.",
    },
    {
      title: "Aba Oportunidades",
      description: "Sugestões de artigos geradas pela IA baseadas no seu nicho e tendências atuais.",
    },
    {
      title: "Aba Funil de Vendas",
      description: "Organize seus artigos por estágio do funil de marketing: Topo (descoberta), Meio (consideração) e Fundo (decisão).",
    },
    {
      title: "Busca e Ações",
      description: "Encontre artigos específicos, crie novos ou gerencie em lote. Use os botões de ação para cada artigo.",
    },
  ],
};
