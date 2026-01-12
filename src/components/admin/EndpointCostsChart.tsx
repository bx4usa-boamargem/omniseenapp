import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface EndpointCostsChartProps {
  data: Array<{
    endpoint: string;
    cost: number;
    calls: number;
  }>;
}

export function EndpointCostsChart({ data }: EndpointCostsChartProps) {
  // Format endpoint names for display
  const chartData = data
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 8)
    .map(item => ({
      name: item.endpoint.replace('weekly-market-intel', 'market-intel').substring(0, 20),
      fullName: item.endpoint,
      cost: item.cost,
      calls: item.calls,
    }));
  
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custo por Endpoint</CardTitle>
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
        <CardTitle className="text-base">Custo por Endpoint</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis 
                type="number" 
                tickFormatter={(value) => `$${value.toFixed(3)}`}
                fontSize={12}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={100}
                fontSize={11}
                tickLine={false}
              />
              <Tooltip 
                formatter={(value: number, name: string, props: { payload?: { calls?: number } }) => {
                  return [
                    <div key="tooltip" className="space-y-1">
                      <p className="font-medium">${value.toFixed(4)}</p>
                      <p className="text-xs text-muted-foreground">{props.payload?.calls} chamadas</p>
                    </div>,
                    'Custo'
                  ];
                }}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload as { fullName?: string } | undefined;
                  return item?.fullName || label;
                }}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar 
                dataKey="cost" 
                fill="hsl(var(--primary))" 
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Total stats */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
          <div>
            <p className="text-sm text-muted-foreground">Total de endpoints</p>
            <p className="text-lg font-semibold">{data.length}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Custo total</p>
            <p className="text-lg font-semibold">
              ${data.reduce((sum, d) => sum + d.cost, 0).toFixed(4)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
