import { MousePointerClick, Eye, TrendingUp, Target, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricItem {
  label: string;
  value: string | number;
  delta?: number;
  icon: React.ReactNode;
}

interface SearchConsoleMetricsBarProps {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  clicksDelta?: number;
  impressionsDelta?: number;
  periodLabel?: string;
}

export function SearchConsoleMetricsBar({
  clicks,
  impressions,
  ctr,
  position,
  clicksDelta = 0,
  impressionsDelta = 0,
  periodLabel
}: SearchConsoleMetricsBarProps) {
  
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('pt-BR');
  };

  const DeltaIndicator = ({ value }: { value: number }) => {
    if (Math.abs(value) < 0.5) {
      return <Minus className="h-3 w-3 text-muted-foreground" />;
    }
    if (value > 0) {
      return (
        <span className="flex items-center text-xs text-green-600 dark:text-green-400">
          <ArrowUpRight className="h-3 w-3" />
          +{Math.abs(value).toFixed(0)}
        </span>
      );
    }
    return (
      <span className="flex items-center text-xs text-red-500 dark:text-red-400">
        <ArrowDownRight className="h-3 w-3" />
        {Math.abs(value).toFixed(0)}
      </span>
    );
  };

  const metrics: MetricItem[] = [
    {
      label: 'Cliques',
      value: formatNumber(clicks),
      delta: clicksDelta,
      icon: <MousePointerClick className="h-4 w-4" />
    },
    {
      label: 'Impressões',
      value: formatNumber(impressions),
      delta: impressionsDelta,
      icon: <Eye className="h-4 w-4" />
    },
    {
      label: 'CTR Médio',
      value: `${ctr.toFixed(2)}%`,
      icon: <TrendingUp className="h-4 w-4" />
    },
    {
      label: 'Posição Média',
      value: position > 0 ? position.toFixed(1) : '-',
      icon: <Target className="h-4 w-4" />
    }
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">
          Métricas de Tráfego Orgânico
        </h3>
        {periodLabel && (
          <span className="text-xs text-muted-foreground">
            {periodLabel}
          </span>
        )}
      </div>
      
      <div className="flex items-center justify-between divide-x divide-border">
        {metrics.map((metric, index) => (
          <div 
            key={metric.label}
            className={cn(
              "flex-1 px-4 first:pl-0 last:pr-0",
              index === 0 && "pl-0"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-muted-foreground">{metric.icon}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">
                {metric.label}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {metric.value}
              </span>
              {metric.delta !== undefined && (
                <DeltaIndicator value={metric.delta} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
