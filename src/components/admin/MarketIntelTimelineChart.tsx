import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MarketIntelTimelineChartProps {
  data: Array<{
    date: string;
    perplexity: number;
    fallback: number;
  }>;
}

export function MarketIntelTimelineChart({ data }: MarketIntelTimelineChartProps) {
  const formattedData = data.map(item => ({
    ...item,
    formattedDate: format(parseISO(item.date), 'dd/MM', { locale: ptBR }),
  }));
  
  const totalPerplexity = data.reduce((sum, d) => sum + d.perplexity, 0);
  const totalFallback = data.reduce((sum, d) => sum + d.fallback, 0);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Evolução de Custos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorPerplexity" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorFallback" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="formattedDate" 
                fontSize={12}
                tickLine={false}
              />
              <YAxis 
                tickFormatter={(value) => `$${value.toFixed(3)}`}
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                formatter={(value: number) => [`$${value.toFixed(4)}`, '']}
                labelFormatter={(label) => `Data: ${label}`}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend verticalAlign="top" height={36} />
              <Area 
                type="monotone" 
                dataKey="perplexity" 
                name="Perplexity"
                stroke="#8b5cf6" 
                fill="url(#colorPerplexity)"
                strokeWidth={2}
              />
              <Area 
                type="monotone" 
                dataKey="fallback" 
                name="Fallback (Lovable AI)"
                stroke="#06b6d4" 
                fill="url(#colorFallback)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
          <div>
            <p className="text-sm text-muted-foreground">Perplexity</p>
            <p className="text-lg font-semibold text-violet-600">${totalPerplexity.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Fallback</p>
            <p className="text-lg font-semibold text-cyan-600">${totalFallback.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-lg font-semibold">${(totalPerplexity + totalFallback).toFixed(4)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
