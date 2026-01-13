import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, MousePointerClick, BookOpen, DollarSign, ArrowDown } from 'lucide-react';

interface ConversionFunnelChartProps {
  impressions: number;
  clicks: number;
  exposureCount: number;
  intentCount: number;
  totalValue: number;
}

export function ConversionFunnelChart({
  impressions,
  clicks,
  exposureCount,
  intentCount,
  totalValue
}: ConversionFunnelChartProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('pt-BR');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const calculateRate = (current: number, previous: number) => {
    if (previous === 0) return '0%';
    return ((current / previous) * 100).toFixed(1) + '%';
  };

  const stages = [
    {
      icon: Eye,
      label: 'Impressões',
      value: impressions,
      color: 'bg-blue-500',
      textColor: 'text-blue-600 dark:text-blue-400',
      width: '100%'
    },
    {
      icon: MousePointerClick,
      label: 'Cliques',
      value: clicks,
      rate: calculateRate(clicks, impressions),
      color: 'bg-green-500',
      textColor: 'text-green-600 dark:text-green-400',
      width: impressions > 0 ? `${Math.max((clicks / impressions) * 100, 15)}%` : '15%'
    },
    {
      icon: BookOpen,
      label: 'Exposição Comercial',
      value: exposureCount,
      rate: calculateRate(exposureCount, clicks),
      color: 'bg-violet-500',
      textColor: 'text-violet-600 dark:text-violet-400',
      width: clicks > 0 ? `${Math.max((exposureCount / clicks) * 100, 10)}%` : '10%',
      description: 'Leitura ≥60%'
    },
    {
      icon: DollarSign,
      label: 'Intenção Comercial',
      value: intentCount,
      rate: calculateRate(intentCount, exposureCount),
      color: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400',
      width: exposureCount > 0 ? `${Math.max((intentCount / exposureCount) * 100, 5)}%` : '5%',
      description: 'Clique no CTA'
    }
  ];

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          Funil: Do Google ao Valor Real
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <div key={stage.label}>
              {/* Stage Bar */}
              <div 
                className={`${stage.color} rounded-lg p-3 flex items-center justify-between transition-all duration-300`}
                style={{ width: stage.width, minWidth: '140px' }}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-white" />
                  <div className="flex flex-col">
                    <span className="text-white font-medium text-sm">{stage.label}</span>
                    {stage.description && (
                      <span className="text-white/70 text-xs">{stage.description}</span>
                    )}
                  </div>
                </div>
                <span className="text-white font-bold">{formatNumber(stage.value)}</span>
              </div>
              
              {/* Rate indicator between stages */}
              {index < stages.length - 1 && stage.rate && (
                <div className="flex items-center gap-2 ml-4 my-1">
                  <ArrowDown className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{stages[index + 1].rate}</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Final Value */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="bg-gradient-to-r from-primary to-purple-600 rounded-lg p-4 text-center">
            <p className="text-white text-sm opacity-90">Valor Total Gerado</p>
            <p className="text-white text-2xl font-bold">{formatCurrency(totalValue)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
