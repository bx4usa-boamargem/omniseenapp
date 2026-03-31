import { useEffect, useState } from 'react';
import { BarChart3, FileText, LayoutTemplate, Users, Zap, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { usePlanLimits, ResourceType } from '@/hooks/usePlanLimits';

interface UsageItem {
  id: ResourceType;
  label: string;
  icon: React.ElementType;
  used: number;
  limit: number;
  unit: string;
  isUnlimited: boolean;
}

export function UsageTab() {
  const { checkLimit } = usePlanLimits();
  const [usageData, setUsageData] = useState<UsageItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsage = async () => {
      setLoading(true);
      try {
        const resources: { id: ResourceType; label: string; icon: React.ElementType; unit: string }[] = [
          { id: 'articles', label: 'Artigos gerados', icon: FileText, unit: 'artigos' },
          { id: 'ebooks', label: 'E-books', icon: LayoutTemplate, unit: 'e-books' },
          { id: 'team_members', label: 'Membros da equipe', icon: Users, unit: 'membros' },
          { id: 'keywords', label: 'Palavras-chave', icon: Zap, unit: 'keywords' },
        ];

        const results = await Promise.all(
          resources.map(async (r) => {
            const result = await checkLimit(r.id);
            return {
              ...r,
              used: result.used,
              limit: result.limit,
              isUnlimited: result.isUnlimited,
            };
          })
        );

        setUsageData(results);
      } catch {
        // Fallback silently
      } finally {
        setLoading(false);
      }
    };

    fetchUsage();
  }, [checkLimit]);

  const getPercentage = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-destructive';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-primary';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Uso do Plano</h3>
        <p className="text-sm text-muted-foreground">
          Acompanhe seu consumo mensal e limites do plano atual.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {usageData.map((item) => {
          const Icon = item.icon;
          const percentage = item.isUnlimited ? 0 : getPercentage(item.used, item.limit);

          return (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </div>
                  <span className="text-sm font-normal text-muted-foreground">
                    {item.used} / {item.isUnlimited ? 'Ilimitado' : item.limit}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Progress
                    value={item.isUnlimited ? 0 : percentage}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    {item.isUnlimited
                      ? 'Sem limite neste plano'
                      : `${item.limit - item.used} ${item.unit} restantes`}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
