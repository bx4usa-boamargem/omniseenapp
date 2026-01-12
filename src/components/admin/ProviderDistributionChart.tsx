import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface ProviderDistributionChartProps {
  data: Array<{
    provider: string;
    cost: number;
    calls: number;
  }>;
}

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

const providerLabels: Record<string, string> = {
  perplexity: 'Perplexity',
  lovable: 'Lovable AI',
  fallback: 'Fallback',
  openai: 'OpenAI',
};

export function ProviderDistributionChart({ data }: ProviderDistributionChartProps) {
  const chartData = data.map((item, index) => ({
    name: providerLabels[item.provider] || item.provider,
    value: item.cost,
    calls: item.calls,
    color: COLORS[index % COLORS.length],
  }));
  
  const totalCost = data.reduce((sum, d) => sum + d.cost, 0);
  
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição por Provider</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-[250px]">
          <p className="text-muted-foreground">Nenhum dado disponível</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Distribuição por Provider</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`$${value.toFixed(4)}`, 'Custo']}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                formatter={(value, entry: { payload?: { calls?: number; value?: number } }) => {
                  const payload = entry?.payload;
                  const percent = totalCost > 0 ? ((payload?.value || 0) / totalCost * 100).toFixed(0) : 0;
                  return `${value} (${percent}%)`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Stats below */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
          {chartData.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.calls} chamadas</p>
              </div>
              <p className="text-sm font-medium">${item.value.toFixed(4)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
