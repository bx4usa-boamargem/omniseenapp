/**
 * Article Template Preview Modal
 * 
 * Mostra preview da estrutura do template selecionado.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, 
  Target, 
  ListOrdered,
  Table,
  List,
  Shield,
  MapPin,
  Sparkles,
  Loader2
} from 'lucide-react';
import { 
  classifyIntent, 
  getIntentDescription, 
  getUrgencyDescription 
} from '@/lib/article-engine/intent';
import { 
  ARTICLE_TEMPLATES, 
  getWordCountRange 
} from '@/lib/article-engine/templates';
import type { TemplateType, ArticleMode } from '@/lib/article-engine/types';

interface ArticleTemplatePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyword: string;
  city: string;
  mode: ArticleMode;
  templateOverride?: TemplateType;
  onGenerate: () => void;
}

const TEMPLATE_NAMES: Record<TemplateType, string> = {
  complete_guide: 'Guia Completo',
  qa_format: 'Perguntas & Respostas',
  comparative: 'Comparativo Técnico',
  problem_solution: 'Problema → Solução',
  educational_steps: 'Educacional em Etapas'
};

const SECTION_TYPE_LABELS: Record<string, string> = {
  intro: 'Introdução',
  intro_problem: 'Introdução (Problema)',
  tldr: 'TL;DR',
  what_is: 'O que é',
  why_matters: 'Por que importa',
  how_works: 'Como funciona',
  step_by_step: 'Passo a passo',
  common_mistakes: 'Erros comuns',
  expert_tips: 'Dicas de especialista',
  local_context: 'Contexto local',
  faq: 'Perguntas Frequentes',
  cta: 'Chamada para ação',
  cta_urgent: 'CTA Urgente',
  symptoms: 'Sinais/Sintomas',
  why_happens: 'Por que acontece',
  consequences: 'Consequências',
  solution_overview: 'Visão geral da solução',
  diy_vs_professional: 'Fazer sozinho vs Profissional',
  step_by_step_fix: 'Como resolver',
  prevention: 'Prevenção',
  when_call_pro: 'Quando chamar profissional',
  local_services: 'Serviços locais',
  comparison_overview: 'Visão comparativa',
  option_a_detail: 'Opção A',
  option_b_detail: 'Opção B',
  option_c_detail: 'Opção C',
  decision_factors: 'Fatores de decisão',
  expert_recommendation: 'Recomendação do especialista',
  local_considerations: 'Considerações locais',
  what_you_will_learn: 'O que você vai aprender',
  prerequisites: 'Pré-requisitos',
  step_1: 'Etapa 1',
  step_2: 'Etapa 2',
  step_3: 'Etapa 3',
  step_4: 'Etapa 4',
  step_5: 'Etapa 5',
  common_pitfalls: 'Erros comuns',
  next_steps: 'Próximos passos',
  expert_insight: 'Insight do especialista',
  main_question_1: 'Pergunta principal 1',
  main_question_2: 'Pergunta principal 2',
  main_question_3: 'Pergunta principal 3',
  main_question_4: 'Pergunta principal 4',
  main_question_5: 'Pergunta principal 5',
  main_question_6: 'Pergunta principal 6',
  related_questions: 'Perguntas relacionadas'
};

export function ArticleTemplatePreviewModal({
  open,
  onOpenChange,
  keyword,
  city,
  mode,
  templateOverride,
  onGenerate
}: ArticleTemplatePreviewModalProps) {
  // Calculate preview data
  const intent = classifyIntent(keyword);
  const selectedTemplate = templateOverride || intent.recommendedTemplate;
  const template = ARTICLE_TEMPLATES[selectedTemplate];
  const wordCountRange = getWordCountRange(template, mode);
  
  // Get urgency color
  const getUrgencyBadgeVariant = () => {
    switch (intent.urgency) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
    }
  };
  
  // Render section features
  const getSectionFeatures = (section: typeof template.baseStructure[0]) => {
    const features: React.ReactNode[] = [];
    
    if (section.includeTable || section.forceTable) {
      features.push(
        <Badge key="table" variant="outline" className="text-xs gap-1">
          <Table className="h-3 w-3" /> TABELA
        </Badge>
      );
    }
    
    if (section.forceList) {
      features.push(
        <Badge key="list" variant="outline" className="text-xs gap-1">
          <List className="h-3 w-3" /> LISTA
        </Badge>
      );
    }
    
    if (section.injectEat) {
      features.push(
        <Badge key="eat" variant="outline" className="text-xs gap-1 border-green-500/50 text-green-600">
          <Shield className="h-3 w-3" /> E-E-A-T
        </Badge>
      );
    }
    
    if (section.geoSpecific) {
      features.push(
        <Badge key="geo" variant="outline" className="text-xs gap-1 border-blue-500/50 text-blue-600">
          <MapPin className="h-3 w-3" /> GEO
        </Badge>
      );
    }
    
    return features;
  };
  
  // Generate reason text
  const getReasonText = () => {
    if (templateOverride) {
      return `Você selecionou manualmente o template "${TEMPLATE_NAMES[templateOverride]}".`;
    }
    
    switch (intent.type) {
      case 'transactional':
        return `A keyword "${keyword}" indica intenção transacional com alta urgência. O template "Problema → Solução" foi selecionado para atender clientes que precisam de ajuda imediata.`;
      case 'commercial':
        return `A keyword "${keyword}" indica pesquisa de preço/comparação. O template "Comparativo" foi selecionado para ajudar na tomada de decisão.`;
      case 'informational':
        if (selectedTemplate === 'educational_steps') {
          return `A keyword "${keyword}" indica busca por tutorial/como fazer. O template "Educacional em Etapas" foi selecionado para ensinar o processo.`;
        }
        if (selectedTemplate === 'qa_format') {
          return `A keyword "${keyword}" indica busca por informação/definição. O template "Perguntas & Respostas" foi selecionado para responder dúvidas.`;
        }
        return `A keyword "${keyword}" é informacional geral. O template "Guia Completo" foi selecionado para cobertura abrangente.`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Preview: Template Selecionado
          </DialogTitle>
          <DialogDescription>
            Visualize a estrutura que será gerada
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">
            {/* Template Info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Template</p>
                <p className="font-medium">{TEMPLATE_NAMES[selectedTemplate]}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Variante</p>
                <p className="font-medium">{template.variants[0]}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Intenção</p>
                <div className="flex items-center gap-2">
                  <Badge variant={getUrgencyBadgeVariant()} className="text-xs">
                    {intent.type}
                  </Badge>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Specs */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Especificações
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-muted-foreground text-xs">Word Count</p>
                  <p className="font-medium">{wordCountRange[0].toLocaleString()} - {wordCountRange[1].toLocaleString()}</p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-muted-foreground text-xs">Seções H2</p>
                  <p className="font-medium">{template.h2Range[0]} - {template.h2Range[1]}</p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <p className="text-muted-foreground text-xs">FAQ</p>
                  <p className="font-medium">8-12 perguntas</p>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Sections */}
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-primary" />
                Estrutura das Seções
              </h4>
              <div className="space-y-2">
                {template.baseStructure.map((section, index) => {
                  const features = getSectionFeatures(section);
                  const label = SECTION_TYPE_LABELS[section.type] || section.type;
                  
                  return (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-2 rounded border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-6">
                          {index + 1}.
                        </span>
                        <span className="text-sm">
                          {section.h2Count === 0 ? (
                            <span className="text-muted-foreground">{label}</span>
                          ) : (
                            label
                          )}
                        </span>
                        {features.length > 0 && (
                          <div className="flex gap-1 ml-2">
                            {features}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {section.targetWords} palavras
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <Separator />
            
            {/* Reason */}
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <h4 className="font-medium flex items-center gap-2 mb-2 text-primary">
                <Sparkles className="h-4 w-4" />
                Por que este template?
              </h4>
              <p className="text-sm text-muted-foreground">
                {getReasonText()}
              </p>
            </div>
          </div>
        </ScrollArea>
        
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button onClick={onGenerate} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Gerar com Este Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
