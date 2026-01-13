import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MetricPoint {
  date: string;
  highScore: number;
  converted: number;
}

interface OpportunityEvolutionChartProps {
  data: MetricPoint[];
}

export function OpportunityEvolutionChart({ data }: OpportunityEvolutionChartProps) {
  const chartData = data.map(point => ({
    ...point,
    dateFormatted: format(new Date(point.date), 'dd/MM', { locale: ptBR })
  }));

  if (data.length === 0) {
    return (
      <Card className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            📈 Evolução de Oportunidades de Alto Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
            Dados insuficientes para gerar o gráfico
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          📈 Evolução de Oportunidades de Alto Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis 
                dataKey="dateFormatted" 
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="highScore" 
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: '#22c55e', strokeWidth: 2 }}
                name="Alto Score (90%+)"
              />
              <Line 
                type="monotone" 
                dataKey="converted" 
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                name="Convertidas"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
