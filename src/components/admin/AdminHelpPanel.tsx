import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Book, ExternalLink, Shield, Database, Users, DollarSign, Zap, Bell, FileText, Settings } from "lucide-react";

const FAQ_ITEMS = [
  {
    category: "Visão Geral",
    icon: Shield,
    items: [
      {
        question: "O que é a OmniSIM?",
        answer: "A OmniSIM é o Sistema de Inteligência de Mercado da Omniseen. É uma máquina autônoma que decide (Radar), executa (Geração), valida (Quality Gate), corrige (Auto-fix), publica (Auto-publish) e aprende (Adaptive ROI) sozinha."
      },
      {
        question: "Qual a diferença entre Platform Admin e Subconta?",
        answer: "O Platform Admin tem acesso total ao sistema, incluindo gestão de custos, equipe e configurações globais. Subcontas são clientes que operam seus próprios blogs dentro da plataforma, com recursos limitados ao seu plano."
      }
    ]
  },
  {
    category: "Custos e Consumo",
    icon: DollarSign,
    items: [
      {
        question: "Como são calculados os custos de IA?",
        answer: "Cada operação (geração de artigo, imagem, análise SEO) é registrada em consumption_logs com tokens usados e custo estimado. O preço por modelo está configurado em model_pricing."
      },
      {
        question: "O que é o Cache de IA?",
        answer: "O sistema armazena respostas comuns em ai_content_cache para evitar chamar a API novamente, economizando até 30% dos custos em prompts similares."
      },
      {
        question: "Como funcionam os alertas de custo?",
        answer: "Configure limites diários, semanais ou mensais em CostAlertManager. Quando o consumo atinge 80% ou 100% do limite, um banner de alerta é exibido automaticamente."
      }
    ]
  },
  {
    category: "Gestão de Clientes",
    icon: Users,
    items: [
      {
        question: "Como criar uma subconta interna?",
        answer: "Vá em 'Subcontas' > 'Criar Conta'. Contas internas (is_internal_account=true) são gerenciadas pela equipe e não aparecem em relatórios de churn."
      },
      {
        question: "O que são os Alertas de Saúde?",
        answer: "São notificações proativas que identificam clientes em risco: muitos dias sem login (churn), margem baixa ou inatividade editorial. Configure thresholds em 'Saúde'."
      },
      {
        question: "Como funciona o sistema de territórios?",
        answer: "Cada subconta pode ter até N territórios (País > Estado > Cidade) dependendo do plano. O Radar gera oportunidades específicas para cada território ativo."
      }
    ]
  },
  {
    category: "Automação Editorial",
    icon: Zap,
    items: [
      {
        question: "O que é o Autopilot?",
        answer: "O Autopilot distribui automaticamente a criação de artigos entre TOFU (topo), MOFU (meio) e BOFU (fundo) do funil, garantindo cobertura estratégica sem intervenção manual."
      },
      {
        question: "Como funciona o Quality Gate?",
        answer: "Antes de publicar, o artigo passa por validações de SEO, compliance (nichos sensíveis) e duplicidade. Se reprovado, o sistema tenta corrigir automaticamente até 3 vezes."
      },
      {
        question: "Posso desativar a publicação automática?",
        answer: "Sim. Em 'Automação', desative 'Publicação Automática'. Os artigos gerados ficarão como rascunho aguardando aprovação manual."
      }
    ]
  },
  {
    category: "Troubleshooting",
    icon: Settings,
    items: [
      {
        question: "Artigos não estão sendo gerados",
        answer: "Verifique: 1) Automação está ativa? 2) Há oportunidades no Radar? 3) O plano tem limite disponível? 4) Veja logs de erro em 'Diagnóstico'."
      },
      {
        question: "Cliente não consegue fazer login",
        answer: "Verifique se o email está confirmado (auto_confirm deve estar ativo). Se usar OAuth, confirme que o domínio está autorizado no Google Cloud Console."
      },
      {
        question: "Custos não estão aparecendo",
        answer: "Os registros em consumption_logs podem estar sem user_id/blog_id. Use o botão 'Migrar Custos' em MissingCostsAlert para corrigir retroativamente."
      },
      {
        question: "RLS está bloqueando operações",
        answer: "Verifique se o usuário tem a role correta em user_roles. Para tabelas de sistema, confirme que a política permite service_role."
      }
    ]
  }
];

const QUICK_LINKS = [
  { label: "Documentação", href: "/docs/ADMIN_GUIDE.md", icon: Book },
  { label: "Arquitetura", href: "/docs/ARCHITECTURE.md", icon: Database },
];

export function AdminHelpPanel() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <HelpCircle className="h-4 w-4" />
          Ajuda
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Book className="h-5 w-5 text-primary" />
            Guia de Administração
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Quick Stats */}
          <div className="p-4 rounded-lg bg-muted/50 border">
            <p className="text-sm font-medium mb-2">Referência Rápida</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-green-600">admin</Badge>
                <span>Acesso total</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-blue-600">platform_admin</Badge>
                <span>Gestor plataforma</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-amber-600">subaccount</Badge>
                <span>Cliente final</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-purple-600">internal</Badge>
                <span>Gerenciado</span>
              </div>
            </div>
          </div>

          {/* FAQ Accordion */}
          <Accordion type="multiple" className="space-y-2">
            {FAQ_ITEMS.map((section, idx) => (
              <AccordionItem 
                key={section.category} 
                value={`section-${idx}`}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <section.icon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{section.category}</span>
                    <Badge variant="secondary" className="text-xs">
                      {section.items.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2">
                    {section.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          {item.question}
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {item.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          {/* Contact */}
          <div className="p-4 rounded-lg border bg-primary/5">
            <p className="text-sm font-medium mb-2">Precisa de mais ajuda?</p>
            <p className="text-xs text-muted-foreground mb-3">
              Entre em contato com o suporte técnico para questões não cobertas neste guia.
            </p>
            <Button variant="outline" size="sm" className="w-full">
              <FileText className="h-4 w-4 mr-2" />
              Abrir Ticket de Suporte
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}