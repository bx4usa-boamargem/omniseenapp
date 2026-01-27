import { FileText, CheckCircle, Eye, Users, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { cn } from '@/lib/utils';

interface StatusCardsRowProps {
  blogId: string | undefined;
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  loading?: boolean;
  iconColor?: string;
  iconBg?: string;
}

function StatCard({ icon: Icon, label, value, loading, iconColor, iconBg }: StatCardProps) {
  return (
    <Card className="hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconBg || 'bg-primary/10')}>
            <Icon className={cn('h-5 w-5', iconColor || 'text-primary')} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1" />
            ) : (
              <p className="text-xl font-bold text-foreground">{value}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StatusCardsRow({ blogId }: StatusCardsRowProps) {
  const { totalArticles, publishedArticles, totalViews, leadsGenerated, loading } = useDashboardMetrics(blogId);

  const stats = [
    {
      icon: FileText,
      label: 'Total de Artigos',
      value: totalArticles,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
    },
    {
      icon: CheckCircle,
      label: 'Publicados',
      value: publishedArticles,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-500/10',
    },
    {
      icon: Eye,
      label: 'Visualizações',
      value: totalViews,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-500/10',
    },
    {
      icon: Users,
      label: 'Leads Gerados',
      value: leadsGenerated,
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <StatCard
          key={stat.label}
          icon={stat.icon}
          label={stat.label}
          value={stat.value}
          loading={loading}
          iconColor={stat.iconColor}
          iconBg={stat.iconBg}
        />
      ))}
    </div>
  );
}
