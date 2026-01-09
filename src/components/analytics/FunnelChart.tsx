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
          { name: 'Scroll 25%', value: counts['scroll_25'] || 0, percentage: 0, color: 'hsl(250, 78%, 62%)' },
          { name: 'Scroll 50%', value: counts['scroll_50'] || 0, percentage: 0, color: 'hsl(255, 74%, 66%)' },
          { name: 'Scroll 75%', value: counts['scroll_75'] || 0, percentage: 0, color: 'hsl(262, 70%, 70%)' },
          { name: 'Leitura Completa', value: counts['scroll_100'] || 0, percentage: 0, color: 'hsl(270, 66%, 74%)' },
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

  // Larguras decrescentes para criar o formato de funil real
  const widthPercents = [100, 82, 66, 52, 40, 30];
  const svgWidth = 400;
  const stepHeight = 55;
  const stepGap = 4;
  const totalHeight = steps.length * (stepHeight + stepGap);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Funil de Engajamento do Conteúdo</CardTitle>
          <CardDescription>Jornada do leitor pelo artigo</CardDescription>
        </CardHeader>
        <CardContent className="h-[450px] flex items-center justify-center">
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
              <div className="relative w-full max-w-lg">
                <svg 
                  viewBox={`0 0 ${svgWidth} ${totalHeight}`} 
                  className="w-full"
                  style={{ maxHeight: '400px' }}
                >
                  <defs>
                    {steps.map((step, index) => (
                      <linearGradient 
                        key={`gradient-${index}`} 
                        id={`funnel-gradient-${index}`} 
                        x1="0%" 
                        y1="0%" 
                        x2="100%" 
                        y2="0%"
                      >
                        <stop offset="0%" stopColor={step.color} stopOpacity="0.9" />
                        <stop offset="50%" stopColor={step.color} stopOpacity="1" />
                        <stop offset="100%" stopColor={step.color} stopOpacity="0.9" />
                      </linearGradient>
                    ))}
                  </defs>
                  
                  {steps.map((step, index) => {
                    const topWidth = (widthPercents[index] / 100) * svgWidth;
                    const bottomWidth = (widthPercents[Math.min(index + 1, widthPercents.length - 1)] / 100) * svgWidth;
                    const y = index * (stepHeight + stepGap);
                    
                    // Calcular pontos do trapézio
                    const topLeft = (svgWidth - topWidth) / 2;
                    const topRight = topLeft + topWidth;
                    const bottomLeft = (svgWidth - bottomWidth) / 2;
                    const bottomRight = bottomLeft + bottomWidth;
                    
                    const dropoff = index > 0 ? steps[index - 1].percentage - step.percentage : 0;
                    
                    return (
                      <Tooltip key={step.name}>
                        <TooltipTrigger asChild>
                          <g className="cursor-pointer transition-all hover:opacity-90">
                            {/* Trapézio principal */}
                            <polygon
                              points={`${topLeft},${y} ${topRight},${y} ${bottomRight},${y + stepHeight} ${bottomLeft},${y + stepHeight}`}
                              fill={`url(#funnel-gradient-${index})`}
                              className="drop-shadow-sm"
                            />
                            
                            {/* Borda sutil */}
                            <polygon
                              points={`${topLeft},${y} ${topRight},${y} ${bottomRight},${y + stepHeight} ${bottomLeft},${y + stepHeight}`}
                              fill="none"
                              stroke="rgba(255,255,255,0.2)"
                              strokeWidth="1"
                            />
                            
                            {/* Nome da etapa */}
                            <text 
                              x={svgWidth / 2} 
                              y={y + 22} 
                              textAnchor="middle" 
                              fill="white" 
                              fontSize="12" 
                              fontWeight="500"
                              className="pointer-events-none"
                            >
                              {step.name}
                            </text>
                            
                            {/* Percentual e visitantes */}
                            <text 
                              x={svgWidth / 2} 
                              y={y + 42} 
                              textAnchor="middle" 
                              fill="white" 
                              fontSize="14" 
                              fontWeight="700"
                              className="pointer-events-none"
                            >
                              {step.percentage}%
                            </text>
                          </g>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-popover">
                          <div className="text-sm">
                            <p className="font-semibold">{step.name}</p>
                            <p className="text-muted-foreground">
                              {step.value.toLocaleString()} visitantes
                            </p>
                            {dropoff > 0 && (
                              <p className="text-destructive text-xs mt-1">
                                Drop-off: -{dropoff}%
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </svg>

                {/* Indicadores de drop-off à direita */}
                <div className="absolute right-0 top-0 h-full flex flex-col justify-around pr-2" style={{ transform: 'translateX(100%)' }}>
                  {steps.map((step, index) => {
                    if (index === 0) return null;
                    const dropoff = steps[index - 1].percentage - step.percentage;
                    if (dropoff <= 0) return null;
                    
                    return (
                      <div 
                        key={`dropoff-${index}`}
                        className="flex items-center gap-1 text-xs text-destructive font-medium whitespace-nowrap"
                        style={{ 
                          marginTop: index === 1 ? '20px' : '0',
                        }}
                      >
                        <TrendingDown className="h-3 w-3" />
                        -{dropoff}%
                      </div>
                    );
                  })}
                </div>
              </div>
            </TooltipProvider>

            {/* Legenda */}
            <div className="flex items-center gap-6 mt-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ background: 'hsl(245, 82%, 58%)' }} />
                <span>Engajamento</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ background: 'hsl(142, 76%, 36%)' }} />
                <span>Conversão</span>
              </div>
            </div>

            {/* Insights Automáticos */}
            <div className="mt-8 p-4 bg-muted/50 rounded-lg w-full max-w-md">
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
