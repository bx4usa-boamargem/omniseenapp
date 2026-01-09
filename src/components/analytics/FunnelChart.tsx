import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, TrendingDown } from "lucide-react";

interface FunnelChartProps {
  blogId: string;
  articleId?: string;
  period: string;
}

interface FunnelStep {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export function FunnelChart({ blogId, articleId, period }: FunnelChartProps) {
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<FunnelStep[]>([]);

  useEffect(() => {
    async function fetchFunnelData() {
      setLoading(true);
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(period));

      let query = supabase
        .from('funnel_events')
        .select('event_type')
        .eq('blog_id', blogId)
        .gte('created_at', startDate.toISOString());

      if (articleId) {
        query = query.eq('article_id', articleId);
      }

      const { data } = await query;

      if (data) {
        const counts: Record<string, number> = {};
        data.forEach((e) => {
          counts[e.event_type] = (counts[e.event_type] || 0) + 1;
        });

        const pageEnter = counts['page_enter'] || 0;
        
        const funnelSteps: FunnelStep[] = [
          { name: 'Entrada no Artigo', value: pageEnter, percentage: 100, color: 'hsl(245, 82%, 58%)' },
          { name: 'Scroll 25%', value: counts['scroll_25'] || 0, percentage: 0, color: 'hsl(245, 72%, 62%)' },
          { name: 'Scroll 50%', value: counts['scroll_50'] || 0, percentage: 0, color: 'hsl(255, 62%, 66%)' },
          { name: 'Scroll 75%', value: counts['scroll_75'] || 0, percentage: 0, color: 'hsl(265, 52%, 70%)' },
          { name: 'Leitura Completa', value: counts['scroll_100'] || 0, percentage: 0, color: 'hsl(275, 42%, 74%)' },
          { name: 'CTA Clicado', value: counts['cta_click'] || 0, percentage: 0, color: 'hsl(142, 76%, 36%)' },
        ];

        funnelSteps.forEach((step) => {
          step.percentage = pageEnter > 0 ? Math.round((step.value / pageEnter) * 100) : 0;
        });

        setSteps(funnelSteps);
      }

      setLoading(false);
    }

    fetchFunnelData();
  }, [blogId, articleId, period]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Funil de Engajamento do Conteúdo</CardTitle>
          <CardDescription>Jornada do leitor pelo artigo</CardDescription>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Funil de Engajamento do Conteúdo</CardTitle>
        <CardDescription>Jornada do leitor pelo artigo</CardDescription>
      </CardHeader>
      <CardContent>
        {steps[0]?.value === 0 ? (
          <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <TrendingDown className="h-8 w-8" />
            </div>
            <p className="font-medium">Nenhum dado de funil disponível</p>
            <p className="text-sm mt-1">Publique artigos para começar a coletar dados</p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-6">
            <TooltipProvider>
              {steps.map((step, index) => {
                // Decreasing width for real funnel shape
                const widthPercent = 100 - (index * 12); // 100%, 88%, 76%, 64%, 52%, 40%
                const dropoff = index > 0 ? steps[index - 1].percentage - step.percentage : 0;
                
                return (
                  <div 
                    key={step.name}
                    className="relative mb-1 transition-all duration-300 hover:scale-[1.02]"
                    style={{ width: `${widthPercent}%`, maxWidth: '500px' }}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div 
                          className="h-14 flex items-center justify-center text-white font-medium rounded-sm cursor-default shadow-sm"
                          style={{ 
                            background: index === steps.length - 1 
                              ? 'linear-gradient(135deg, hsl(142, 76%, 36%), hsl(142, 70%, 45%))'
                              : `linear-gradient(135deg, hsl(245, 82%, ${58 + index * 3}%), hsl(280, 80%, ${60 + index * 3}%))`,
                            clipPath: 'polygon(2% 0%, 98% 0%, 100% 100%, 0% 100%)'
                          }}
                        >
                          <div className="text-center">
                            <div className="text-xs font-medium opacity-90">{step.name}</div>
                            <div className="text-lg font-bold">{step.percentage}%</div>
                          </div>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p className="font-medium">{step.value.toLocaleString()} visitantes</p>
                        <p className="text-xs text-muted-foreground">
                          {step.percentage}% do total de entradas
                        </p>
                      </TooltipContent>
                    </Tooltip>
                    
                    {/* Drop-off indicator */}
                    {dropoff > 0 && (
                      <div className="absolute -right-16 top-1/2 -translate-y-1/2 text-xs text-destructive font-medium flex items-center gap-1">
                        <TrendingDown className="h-3 w-3" />
                        -{dropoff}%
                      </div>
                    )}
                  </div>
                );
              })}
            </TooltipProvider>

            {/* Automatic Insights */}
            <div className="mt-10 p-4 bg-muted/50 rounded-lg w-full max-w-md">
              <h4 className="font-medium text-sm mb-2">Insights Automáticos</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {steps[1]?.percentage < 50 && (
                  <li>• Alto abandono no início — considere melhorar a introdução</li>
                )}
                {steps[4]?.percentage > 0 && steps[5]?.percentage < steps[4]?.percentage * 0.2 && (
                  <li>• Poucos cliques no CTA — considere reposicionar ou melhorar o copy</li>
                )}
                {steps[4]?.percentage > 30 && (
                  <li className="text-green-600">✓ Boa taxa de leitura completa ({steps[4].percentage}%)</li>
                )}
                {steps[4]?.percentage <= 30 && steps[4]?.percentage > 0 && (
                  <li>• Taxa de leitura completa abaixo de 30% — artigo pode estar longo demais</li>
                )}
                {steps[5]?.percentage > 10 && (
                  <li className="text-green-600">✓ Excelente conversão de CTA ({steps[5].percentage}%)</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
