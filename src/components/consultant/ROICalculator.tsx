import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { DollarSign, Eye, Target, HelpCircle } from 'lucide-react';

interface ROICalculatorProps {
  // Legacy props (still supported)
  totalViews?: number;
  totalShares?: number;
  publishedArticles?: number;
  highScoreOpportunities?: number;
  valuePerView?: number;
  valuePerShare?: number;
  valuePerArticle?: number;
  valuePerHighScore?: number;
  // New 2-step conversion model
  conversionVisibility?: number;
  conversionIntent?: number;
  valuePerVisibility?: number;
  valuePerIntent?: number;
  currency?: string;
}

export function ROICalculator({
  totalViews = 0,
  totalShares = 0,
  publishedArticles = 0,
  highScoreOpportunities = 0,
  valuePerView = 0.50,
  valuePerShare = 2.00,
  valuePerArticle = 200.00,
  valuePerHighScore = 50.00,
  conversionVisibility,
  conversionIntent,
  valuePerVisibility = 5.00,
  valuePerIntent = 50.00,
  currency = 'BRL'
}: ROICalculatorProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  // Use new model if conversion data is provided
  const useNewModel = conversionVisibility !== undefined || conversionIntent !== undefined;

  if (useNewModel) {
    const visibilityCount = conversionVisibility || 0;
    const intentCount = conversionIntent || 0;
    const visibilityValue = visibilityCount * valuePerVisibility;
    const intentValue = intentCount * valuePerIntent;
    const totalValue = visibilityValue + intentValue;

    const items = [
      { 
        label: 'Conversão de Visibilidade', 
        description: 'Leitores qualificados (≥60% de leitura)',
        icon: Eye,
        count: visibilityCount, 
        rate: valuePerVisibility, 
        value: visibilityValue,
        color: 'text-blue-600 dark:text-blue-400',
        tooltip: 'Pessoas que realmente consumiram seu conteúdo. Representa quando sua empresa entra na frente do lead.'
      },
      { 
        label: 'Conversão de Intenção', 
        description: 'Cliques no CTA',
        icon: Target,
        count: intentCount, 
        rate: valuePerIntent, 
        value: intentValue,
        color: 'text-green-600 dark:text-green-400',
        tooltip: 'Pessoas que demonstraram interesse ativo clicando para falar com você.'
      }
    ];

    return (
      <TooltipProvider>
        <Card className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              ROI por Conversão
            </CardTitle>
            <CardDescription>
              Modelo de 2 etapas: Visibilidade → Intenção
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {items.map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {item.label}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-sm">{item.tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className={`font-bold ${item.color}`}>
                    {formatCurrency(item.value)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground pl-6">
                  <span>{item.description}</span>
                  <span>
                    {item.count.toLocaleString()} × {formatCurrency(item.rate)}
                  </span>
                </div>
              </div>
            ))}
            
            <div className="border-t border-slate-200 dark:border-white/10 pt-4 mt-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    Valor Total Gerado
                  </span>
                  <p className="text-xs text-muted-foreground">
                    Visibilidade + Intenção
                  </p>
                </div>
                <span className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(totalValue)}
                </span>
              </div>
            </div>

            {/* Message */}
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20 mt-4">
              <p className="text-xs text-center text-gray-600 dark:text-gray-300">
                "Cada leitura é uma vitória. Cada clique no CTA é uma oportunidade real."
              </p>
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>
    );
  }

  // Legacy model
  const viewsValue = totalViews * valuePerView;
  const sharesValue = totalShares * valuePerShare;
  const articlesValue = publishedArticles * valuePerArticle;
  const highScoreValue = highScoreOpportunities * valuePerHighScore;
  const totalValue = viewsValue + sharesValue + articlesValue + highScoreValue;

  const items = [
    { 
      label: 'Visualizações', 
      count: totalViews, 
      rate: valuePerView, 
      value: viewsValue 
    },
    { 
      label: 'Compartilhamentos', 
      count: totalShares, 
      rate: valuePerShare, 
      value: sharesValue 
    },
    { 
      label: 'Artigos publicados', 
      count: publishedArticles, 
      rate: valuePerArticle, 
      value: articlesValue 
    },
    { 
      label: 'Oportunidades 90%+', 
      count: highScoreOpportunities, 
      rate: valuePerHighScore, 
      value: highScoreValue 
    }
  ];

  return (
    <Card className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          ROI Estimado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <div className="text-gray-600 dark:text-gray-400">
              <span>{item.label}: </span>
              <span className="font-medium text-gray-900 dark:text-white">{item.count.toLocaleString()}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500 mr-2">
                × {formatCurrency(item.rate)}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(item.value)}
              </span>
            </div>
          </div>
        ))}
        
        <div className="border-t border-slate-200 dark:border-white/10 pt-3 mt-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-900 dark:text-white">
              Total Estimado
            </span>
            <span className="text-xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totalValue)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
