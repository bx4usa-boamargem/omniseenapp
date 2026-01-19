import { 
  FileText, 
  CheckCircle, 
  Eye, 
  Users, 
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';

interface MetricCardsRowProps {
  blogId: string | undefined;
}

interface MetricCardProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string | number;
  delta?: number;
  loading?: boolean;
  prefix?: string;
}

function MetricCard({ icon, iconBg, label, value, delta, loading, prefix }: MetricCardProps) {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-8 w-16" />
      </div>
    );
  }

  const getDeltaColor = () => {
    if (delta === undefined || delta === 0) return 'text-muted-foreground';
    return delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  const getDeltaIcon = () => {
    if (delta === undefined || delta === 0) return <Minus className="h-3 w-3" />;
    return delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />;
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
      <div className={`inline-flex p-2.5 rounded-lg ${iconBg} mb-3`}>
        {icon}
      </div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold text-foreground">
          {prefix}{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}
        </p>
        {delta !== undefined && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${getDeltaColor()}`}>
            {getDeltaIcon()}
            <span>{Math.abs(delta)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function MetricCardsRow({ blogId }: MetricCardsRowProps) {
  const metrics = useDashboardMetrics(blogId);

  const cards = [
    {
      icon: <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
      iconBg: 'bg-purple-100 dark:bg-purple-500/20',
      label: 'Total de Artigos',
      value: metrics.totalArticles,
      delta: metrics.totalArticlesDelta,
    },
    {
      icon: <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />,
      iconBg: 'bg-green-100 dark:bg-green-500/20',
      label: 'Publicados',
      value: metrics.publishedArticles,
      delta: metrics.publishedDelta,
    },
    {
      icon: <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
      iconBg: 'bg-blue-100 dark:bg-blue-500/20',
      label: 'Visualizações',
      value: metrics.totalViews,
      delta: metrics.viewsDelta,
    },
    {
      icon: <Users className="h-5 w-5 text-orange-600 dark:text-orange-400" />,
      iconBg: 'bg-orange-100 dark:bg-orange-500/20',
      label: 'Leads Gerados',
      value: metrics.leadsGenerated,
      delta: metrics.leadsDelta,
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
      {cards.map((card, index) => (
        <MetricCard
          key={index}
          icon={card.icon}
          iconBg={card.iconBg}
          label={card.label}
          value={card.value}
          delta={card.delta}
          loading={metrics.loading}
        />
      ))}
    </div>
  );
}
