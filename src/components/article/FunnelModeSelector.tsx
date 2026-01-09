import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Target, BookOpen, Award, ShoppingCart, UserCheck } from "lucide-react";

export type FunnelMode = 'top' | 'middle' | 'bottom';
export type ArticleGoal = 'educar' | 'autoridade' | 'apoiar_vendas' | 'converter';

interface FunnelModeSelectorProps {
  funnelMode: FunnelMode;
  onFunnelModeChange: (mode: FunnelMode) => void;
  articleGoal: ArticleGoal | null;
  onArticleGoalChange: (goal: ArticleGoal | null) => void;
  disabled?: boolean;
}

const FUNNEL_OPTIONS = [
  {
    value: 'top' as FunnelMode,
    label: 'Topo de Funil',
    subtitle: 'Educação',
    description: 'Esclarecer o problema e gerar confiança',
    tone: 'Educativo, empático, não comercial',
    cta: 'CTA leve e opcional',
    icon: TrendingUp,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  {
    value: 'middle' as FunnelMode,
    label: 'Meio de Funil',
    subtitle: 'Consideração',
    description: 'Ajudar o leitor a avaliar soluções',
    tone: 'Consultivo, comparativo, racional',
    cta: 'CTA moderado',
    icon: Users,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  {
    value: 'bottom' as FunnelMode,
    label: 'Fundo de Funil',
    subtitle: 'Conversão',
    description: 'Levar à ação',
    tone: 'Direto, seguro, orientado a decisão',
    cta: 'CTA forte e explícito',
    icon: Target,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
];

const GOAL_OPTIONS = [
  {
    value: 'educar' as ArticleGoal,
    label: 'Educar',
    description: 'Educar o mercado sobre o problema',
    icon: BookOpen,
  },
  {
    value: 'autoridade' as ArticleGoal,
    label: 'Autoridade',
    description: 'Demonstrar expertise',
    icon: Award,
  },
  {
    value: 'apoiar_vendas' as ArticleGoal,
    label: 'Apoiar Vendas',
    description: 'Fornecer argumentos de venda',
    icon: ShoppingCart,
  },
  {
    value: 'converter' as ArticleGoal,
    label: 'Converter',
    description: 'Converter em lead/cliente',
    icon: UserCheck,
  },
];

export function FunnelModeSelector({
  funnelMode,
  onFunnelModeChange,
  articleGoal,
  onArticleGoalChange,
  disabled = false,
}: FunnelModeSelectorProps) {
  return (
    <div className="space-y-6">
      {/* Funnel Mode Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Modo de Funil</Label>
          <Badge variant="secondary" className="text-xs">Obrigatório</Badge>
        </div>
        
        <RadioGroup
          value={funnelMode}
          onValueChange={(v) => onFunnelModeChange(v as FunnelMode)}
          disabled={disabled}
          className="grid grid-cols-1 md:grid-cols-3 gap-3"
        >
          {FUNNEL_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = funnelMode === option.value;
            
            return (
              <Label
                key={option.value}
                htmlFor={`funnel-${option.value}`}
                className="cursor-pointer"
              >
                <Card
                  className={`p-4 transition-all ${
                    isSelected
                      ? `${option.bgColor} ${option.borderColor} border-2`
                      : 'hover:border-primary/50'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem
                      value={option.value}
                      id={`funnel-${option.value}`}
                      className="mt-1"
                    />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${option.color}`} />
                        <span className="font-medium text-sm">{option.label}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {option.subtitle}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-2">
                        {option.description}
                      </p>
                      {isSelected && (
                        <div className="mt-2 pt-2 border-t space-y-1">
                          <p className="text-xs"><strong>Tom:</strong> {option.tone}</p>
                          <p className="text-xs"><strong>CTA:</strong> {option.cta}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </Label>
            );
          })}
        </RadioGroup>
      </div>

      {/* Article Goal Selection */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Objetivo do Artigo</Label>
          <Badge variant="outline" className="text-xs">Opcional</Badge>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {GOAL_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = articleGoal === option.value;
            
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onArticleGoalChange(isSelected ? null : option.value)}
                disabled={disabled}
                className={`p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-primary/10 border-primary'
                    : 'hover:border-primary/50 hover:bg-muted/50'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm font-medium ${isSelected ? 'text-primary' : ''}`}>
                    {option.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
