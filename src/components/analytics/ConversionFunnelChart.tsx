import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, TrendingDown, Eye, Target, DollarSign, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversionFunnelChartProps {
  blogId: string;
  articleId?: string;
  period: string;
  valuePerVisibility?: number;
  valuePerIntent?: number;
}

interface FunnelStep {
  name: string;
  label: string;
  value: number;
  percentage: number;
  color: string;
  icon?: React.ComponentType<{ className?: string }>;
  isConversion?: boolean;
  conversionType?: 'visibility' | 'intent';
}

export function ConversionFunnelChart({ 
  blogId, 
  articleId, 
  period,
  valuePerVisibility = 5.00,
  valuePerIntent = 50.00
}: ConversionFunnelChartProps) {
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [totalValue, setTotalValue] = useState(0);

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
        // Reads = scroll 60%+ (75% ou 100% são leituras reais)
        const reads = (counts['scroll_75'] || 0) + (counts['scroll_100'] || 0);
        const ctaClicks = counts['cta_click'] || 0;

        // Valores
        const visibilityValue = reads * valuePerVisibility;
        const intentValue = ctaClicks * valuePerIntent;
        setTotalValue(visibilityValue + intentValue);
        
        const funnelSteps: FunnelStep[] = [
          { 
            name: 'views', 
            label: 'Visualizações do Artigo', 
            value: pageEnter, 
            percentage: 100, 
            color: 'hsl(var(--muted-foreground))' 
          },
          { 
            name: 'visibility', 
            label: 'Conversão de Visibilidade', 
            value: reads, 
            percentage: 0, 
            color: 'hsl(220, 70%, 55%)',
            icon: Eye,
            isConversion: true,
            conversionType: 'visibility'
          },
          { 
            name: 'intent', 
            label: 'Conversão de Intenção', 
            value: ctaClicks, 
            percentage: 0, 
            color: 'hsl(142, 76%, 36%)',
            icon: Target,
            isConversion: true,
            conversionType: 'intent'
          },
        ];

        funnelSteps.forEach((step) => {
          step.percentage = pageEnter > 0 ? Math.round((step.value / pageEnter) * 100) : 0;
        });

        setSteps(funnelSteps);
      }

      setLoading(false);
    }

    fetchFunnelData();
  }, [blogId, articleId, period, valuePerVisibility, valuePerIntent]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Larguras decrescentes para criar o formato de funil real
  const widthPercents = [100, 70, 45];
  const svgWidth = 400;
  const stepHeight = 70;
  const stepGap = 8;
  const totalHeight = steps.length * (stepHeight + stepGap) + 60;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Funil de Valor Comercial
          </CardTitle>
          <CardDescription>De visitas a valor real</CardDescription>
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
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          Funil de Valor Comercial
        </CardTitle>
        <CardDescription>De visitas a valor real</CardDescription>
      </CardHeader>
      <CardContent>
        {steps[0]?.value === 0 ? (
          <div className="h-[350px] flex flex-col items-center justify-center text-muted-foreground">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <TrendingDown className="h-8 w-8" />
            </div>
            <p className="font-medium">Nenhum dado de funil disponível</p>
            <p className="text-sm mt-1">Publique artigos para começar a coletar dados</p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4">
            <TooltipProvider>
              <div className="relative w-full max-w-lg">
                <svg 
                  viewBox={`0 0 ${svgWidth} ${totalHeight}`} 
                  className="w-full"
                  style={{ maxHeight: '380px' }}
                >
                  <defs>
                    {steps.map((step, index) => (
                      <linearGradient 
                        key={`gradient-${index}`} 
                        id={`conversion-gradient-${index}`} 
                        x1="0%" 
                        y1="0%" 
                        x2="100%" 
                        y2="0%"
                      >
                        <stop offset="0%" stopColor={step.color} stopOpacity="0.85" />
                        <stop offset="50%" stopColor={step.color} stopOpacity="1" />
                        <stop offset="100%" stopColor={step.color} stopOpacity="0.85" />
                      </linearGradient>
                    ))}
                  </defs>
                  
                  {steps.map((step, index) => {
                    const topWidth = (widthPercents[index] / 100) * svgWidth;
                    const bottomWidth = (widthPercents[Math.min(index + 1, widthPercents.length - 1)] / 100) * svgWidth;
                    const y = index * (stepHeight + stepGap);
                    
                    const topLeft = (svgWidth - topWidth) / 2;
                    const topRight = topLeft + topWidth;
                    const bottomLeft = (svgWidth - bottomWidth) / 2;
                    const bottomRight = bottomLeft + bottomWidth;
                    
                    const dropoff = index > 0 ? steps[index - 1].percentage - step.percentage : 0;
                    const conversionValue = step.conversionType === 'visibility' 
                      ? step.value * valuePerVisibility
                      : step.conversionType === 'intent'
                        ? step.value * valuePerIntent
                        : 0;
                    
                    return (
                      <Tooltip key={step.name}>
                        <TooltipTrigger asChild>
                          <g className="cursor-pointer transition-all hover:opacity-90">
                            <polygon
                              points={`${topLeft},${y} ${topRight},${y} ${bottomRight},${y + stepHeight} ${bottomLeft},${y + stepHeight}`}
                              fill={`url(#conversion-gradient-${index})`}
                              className="drop-shadow-sm"
                            />
                            
                            <polygon
                              points={`${topLeft},${y} ${topRight},${y} ${bottomRight},${y + stepHeight} ${bottomLeft},${y + stepHeight}`}
                              fill="none"
                              stroke="rgba(255,255,255,0.2)"
                              strokeWidth="1"
                            />
                            
                            {/* Icon indicator for conversions */}
                            {step.isConversion && (
                              <circle
                                cx={svgWidth / 2 - 60}
                                cy={y + stepHeight / 2}
                                r="12"
                                fill="rgba(255,255,255,0.2)"
                              />
                            )}
                            
                            <text 
                              x={svgWidth / 2} 
                              y={y + 22} 
                              textAnchor="middle" 
                              fill="white" 
                              fontSize="11" 
                              fontWeight="500"
                              className="pointer-events-none"
                            >
                              {step.isConversion ? `🎯 ${step.label}` : step.label}
                            </text>
                            
                            <text 
                              x={svgWidth / 2} 
                              y={y + 42} 
                              textAnchor="middle" 
                              fill="white" 
                              fontSize="18" 
                              fontWeight="700"
                              className="pointer-events-none"
                            >
                              {step.value.toLocaleString()} ({step.percentage}%)
                            </text>

                            {step.isConversion && (
                              <text 
                                x={svgWidth / 2} 
                                y={y + 60} 
                                textAnchor="middle" 
                                fill="rgba(255,255,255,0.9)" 
                                fontSize="12" 
                                fontWeight="600"
                                className="pointer-events-none"
                              >
                                Valor: {formatCurrency(conversionValue)}
                              </text>
                            )}
                          </g>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-popover">
                          <div className="text-sm space-y-1">
                            <p className="font-semibold">{step.label}</p>
                            <p className="text-muted-foreground">
                              {step.value.toLocaleString()} {step.isConversion ? 'conversões' : 'visitantes'}
                            </p>
                            {step.isConversion && (
                              <p className="text-green-600 font-medium">
                                Valor: {formatCurrency(conversionValue)}
                              </p>
                            )}
                            {dropoff > 0 && (
                              <p className="text-destructive text-xs">
                                Drop-off: -{dropoff}%
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}

                  {/* Total Value Box */}
                  <rect
                    x={svgWidth / 2 - 80}
                    y={steps.length * (stepHeight + stepGap) + 10}
                    width="160"
                    height="40"
                    rx="8"
                    fill="hsl(142, 76%, 36%)"
                  />
                  <text 
                    x={svgWidth / 2} 
                    y={steps.length * (stepHeight + stepGap) + 25} 
                    textAnchor="middle" 
                    fill="white" 
                    fontSize="10" 
                    fontWeight="500"
                  >
                    💰 VALOR TOTAL GERADO
                  </text>
                  <text 
                    x={svgWidth / 2} 
                    y={steps.length * (stepHeight + stepGap) + 43} 
                    textAnchor="middle" 
                    fill="white" 
                    fontSize="16" 
                    fontWeight="700"
                  >
                    {formatCurrency(totalValue)}
                  </text>
                </svg>

                {/* Drop-off indicators */}
                <div className="absolute right-0 top-0 h-full flex flex-col" style={{ transform: 'translateX(calc(100% + 8px))' }}>
                  {steps.map((step, index) => {
                    if (index === 0) return null;
                    const dropoff = steps[index - 1].percentage - step.percentage;
                    if (dropoff <= 0) return null;
                    
                    return (
                      <div 
                        key={`dropoff-${index}`}
                        className="flex items-center gap-1 text-xs text-destructive font-medium whitespace-nowrap"
                        style={{ 
                          position: 'absolute',
                          top: `${((index * (stepHeight + stepGap)) / totalHeight) * 100}%`,
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

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-500" />
                <span>Visibilidade (leitores reais)</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-green-500" />
                <span>Intenção (cliques CTA)</span>
              </div>
            </div>

            {/* Message */}
            <div className="mt-6 p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg w-full max-w-md text-center border border-green-500/20">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                "Nosso trabalho é colocar sua empresa na frente do cliente certo.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                <span className="text-blue-600 dark:text-blue-400">Cada leitura é uma vitória.</span>
                {' '}
                <span className="text-green-600 dark:text-green-400">Cada clique no CTA é uma oportunidade real.</span>"
              </p>
            </div>

            {/* Insights */}
            <div className="mt-4 p-4 bg-muted/50 rounded-lg w-full max-w-md">
              <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Insights Automáticos
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                {steps[1]?.percentage >= 30 && (
                  <li className="text-green-600">✓ Excelente taxa de leitura qualificada ({steps[1].percentage}%)</li>
                )}
                {steps[1]?.percentage > 0 && steps[1]?.percentage < 20 && (
                  <li>• Taxa de leitura baixa — considere melhorar a introdução</li>
                )}
                {steps[2]?.percentage >= 10 && (
                  <li className="text-green-600">✓ Ótima conversão de intenção ({steps[2].percentage}%)</li>
                )}
                {steps[2]?.percentage > 0 && steps[2]?.percentage < 5 && steps[1]?.value > 10 && (
                  <li>• Poucos cliques no CTA — considere reposicionar ou melhorar o copy</li>
                )}
                {totalValue > 0 && (
                  <li className="text-purple-600 font-medium">
                    💰 Valor total gerado: {formatCurrency(totalValue)}
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
