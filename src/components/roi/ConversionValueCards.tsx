import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, Target, DollarSign, TrendingUp, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversionValueCardsProps {
  conversionVisibility: number;
  conversionIntent: number;
  valuePerVisibility?: number;
  valuePerIntent?: number;
  previousVisibility?: number;
  previousIntent?: number;
  currency?: string;
}

export function ConversionValueCards({
  conversionVisibility,
  conversionIntent,
  valuePerVisibility = 5.00,
  valuePerIntent = 50.00,
  previousVisibility = 0,
  previousIntent = 0,
  currency = 'BRL'
}: ConversionValueCardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const visibilityValue = conversionVisibility * valuePerVisibility;
  const intentValue = conversionIntent * valuePerIntent;
  const totalValue = visibilityValue + intentValue;

  const getDelta = (current: number, previous: number) => {
    if (previous === 0) return null;
    return ((current - previous) / previous) * 100;
  };

  const visibilityDelta = getDelta(conversionVisibility, previousVisibility);
  const intentDelta = getDelta(conversionIntent, previousIntent);

  const cards = [
    {
      icon: Eye,
      label: 'Conversão de Visibilidade',
      count: conversionVisibility,
      countLabel: 'leitores reais',
      value: visibilityValue,
      rateLabel: `${formatCurrency(valuePerVisibility)}/leitura`,
      delta: visibilityDelta,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10',
      tooltip: 'Pessoas que realmente viram sua empresa através do conteúdo (≥60% de leitura)'
    },
    {
      icon: Target,
      label: 'Conversão de Intenção',
      count: conversionIntent,
      countLabel: 'cliques CTA',
      value: intentValue,
      rateLabel: `${formatCurrency(valuePerIntent)}/clique`,
      delta: intentDelta,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-500/10',
      tooltip: 'Pessoas que demonstraram interesse real em falar com você (clicou no CTA)'
    },
    {
      icon: DollarSign,
      label: 'Valor Total Gerado',
      count: null,
      countLabel: null,
      value: totalValue,
      rateLabel: 'visibilidade + intenção',
      delta: null,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-500/10',
      tooltip: 'Valor comercial total gerado pelo conteúdo'
    }
  ];

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.label} className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className={cn('p-2.5 rounded-lg', card.bgColor)}>
                  <card.icon className={cn('h-5 w-5', card.color)} />
                </div>
                <div className="flex items-center gap-2">
                  {card.delta !== null && (
                    <div className={cn(
                      'flex items-center gap-1 text-xs font-medium',
                      card.delta >= 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      <TrendingUp className={cn('h-3 w-3', card.delta < 0 && 'rotate-180')} />
                      {Math.abs(card.delta).toFixed(0)}%
                    </div>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-sm">{card.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              <div className="mt-4 space-y-1">
                {card.count !== null && (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-gray-900 dark:text-white">
                      {card.count.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {card.countLabel}
                    </span>
                  </div>
                )}
                
                <div className={cn(
                  "flex items-baseline gap-2",
                  card.count === null && "mt-2"
                )}>
                  <span className={cn(
                    "font-bold",
                    card.count !== null ? "text-xl" : "text-3xl",
                    card.color
                  )}>
                    {formatCurrency(card.value)}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground mt-1">
                  {card.rateLabel}
                </p>
              </div>

              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-slate-100 dark:border-white/10">
                {card.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </TooltipProvider>
  );
}
