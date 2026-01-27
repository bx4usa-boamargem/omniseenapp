import { BarChart3, FileText, LayoutTemplate, Users, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface UsageItem {
  id: string;
  label: string;
  icon: React.ElementType;
  used: number;
  limit: number;
  unit: string;
}

// TODO: Replace with real data from useSubscription/useBlog
const USAGE_DATA: UsageItem[] = [
  {
    id: 'articles',
    label: 'Artigos gerados',
    icon: FileText,
    used: 12,
    limit: 50,
    unit: 'artigos',
  },
  {
    id: 'pages',
    label: 'Super Páginas',
    icon: LayoutTemplate,
    used: 3,
    limit: 10,
    unit: 'páginas',
  },
  {
    id: 'leads',
    label: 'Leads capturados',
    icon: Users,
    used: 45,
    limit: 500,
    unit: 'leads',
  },
  {
    id: 'ai-credits',
    label: 'Créditos de IA',
    icon: Zap,
    used: 1500,
    limit: 5000,
    unit: 'tokens',
  },
];

export function UsageTab() {
  const getPercentage = (used: number, limit: number) => {
    return Math.min((used / limit) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-destructive';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-primary';
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Uso do Plano</h3>
        <p className="text-sm text-muted-foreground">
          Acompanhe seu consumo mensal e limites do plano atual.
        </p>
      </div>

      {/* Usage Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {USAGE_DATA.map((item) => {
          const Icon = item.icon;
          const percentage = getPercentage(item.used, item.limit);
          const progressColor = getProgressColor(percentage);

          return (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </div>
                  <span className="text-sm font-normal text-muted-foreground">
                    {item.used} / {item.limit}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Progress 
                    value={percentage} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    {item.limit - item.used} {item.unit} restantes
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Billing Cycle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Ciclo de Faturamento
          </CardTitle>
          <CardDescription>
            Seu uso é renovado mensalmente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Próxima renovação</p>
              <p className="text-sm text-muted-foreground">
                {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium">Período atual</p>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
