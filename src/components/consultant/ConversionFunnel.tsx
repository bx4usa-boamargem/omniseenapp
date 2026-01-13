import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ConversionFunnelProps {
  totalOpportunities: number;
  highScoreOpportunities: number;
  convertedToArticles: number;
  publishedArticles: number;
}

export function ConversionFunnel({
  totalOpportunities,
  highScoreOpportunities,
  convertedToArticles,
  publishedArticles
}: ConversionFunnelProps) {
  const steps = [
    { label: 'Oportunidades', value: totalOpportunities, color: 'bg-gray-400' },
    { label: 'Alto Score (90%+)', value: highScoreOpportunities, color: 'bg-yellow-500' },
    { label: 'Convertidas em Artigos', value: convertedToArticles, color: 'bg-blue-500' },
    { label: 'Publicadas', value: publishedArticles, color: 'bg-green-500' }
  ];

  const maxValue = Math.max(...steps.map(s => s.value), 1);

  return (
    <Card className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          🏆 Funil de Conversão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {steps.map((step, index) => {
          const widthPercent = (step.value / maxValue) * 100;
          const conversionRate = index > 0 && steps[index - 1].value > 0
            ? ((step.value / steps[index - 1].value) * 100).toFixed(0)
            : null;

          return (
            <div key={step.label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">{step.label}</span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 dark:text-white">{step.value}</span>
                  {conversionRate && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      ({conversionRate}%)
                    </span>
                  )}
                </div>
              </div>
              <div className="h-6 bg-gray-100 dark:bg-white/5 rounded-lg overflow-hidden">
                <div 
                  className={cn('h-full rounded-lg transition-all duration-500', step.color)}
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
