import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Globe, DollarSign, Loader2, Activity, Building2, 
  TrendingUp, CheckCircle2, XCircle, Zap
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ProviderDistributionChart } from './ProviderDistributionChart';
import { EndpointCostsChart } from './EndpointCostsChart';
import { MarketIntelTimelineChart } from './MarketIntelTimelineChart';

interface AIUsageLog {
  id: string;
  blog_id: string | null;
  provider: string;
  endpoint: string;
  cost_usd: number;
  tokens_used: number | null;
  success: boolean | null;
  error_message: string | null;
  metadata: unknown;
  created_at: string;
}

interface MarketIntelCostsTabProps {
  startDate: Date;
  endDate: Date;
}

export function MarketIntelCostsTab({ startDate, endDate }: MarketIntelCostsTabProps) {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AIUsageLog[]>([]);
  const [blogNames, setBlogNames] = useState<Record<string, string>>({});
  
  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);
  
  const fetchData = async () => {
    setLoading(true);
    
    // Fetch AI usage logs
    const { data: logsData, error: logsError } = await supabase
      .from('ai_usage_logs')
      .select('*')
      .gte('created_at', format(startDate, 'yyyy-MM-dd'))
      .lte('created_at', format(endDate, 'yyyy-MM-dd') + 'T23:59:59')
      .order('created_at', { ascending: false });
    
    if (logsError) {
      console.error('Error fetching AI logs:', logsError);
      setLoading(false);
      return;
    }
    
    setLogs(logsData || []);
    
    // Fetch blog names for the logs
    const blogIds = [...new Set((logsData || []).map(l => l.blog_id).filter(Boolean))];
    if (blogIds.length > 0) {
      const { data: blogs } = await supabase
        .from('blogs')
        .select('id, name')
        .in('id', blogIds);
      
      const namesMap: Record<string, string> = {};
      (blogs || []).forEach(b => { namesMap[b.id] = b.name; });
      setBlogNames(namesMap);
    }
    
    setLoading(false);
  };
  
  // Calculate summaries
  const summaries = useMemo(() => {
    const totalCost = logs.reduce((sum, log) => sum + (log.cost_usd || 0), 0);
    const totalCalls = logs.length;
    const successfulCalls = logs.filter(l => l.success !== false).length;
    const uniqueBlogs = new Set(logs.map(l => l.blog_id).filter(Boolean)).size;
    const costPerBlog = uniqueBlogs > 0 ? totalCost / uniqueBlogs : 0;
    
    // By provider
    const byProvider: Record<string, { cost: number; calls: number }> = {};
    logs.forEach(log => {
      const provider = log.provider || 'unknown';
      if (!byProvider[provider]) byProvider[provider] = { cost: 0, calls: 0 };
      byProvider[provider].cost += log.cost_usd || 0;
      byProvider[provider].calls += 1;
    });
    
    // By endpoint
    const byEndpoint: Record<string, { cost: number; calls: number }> = {};
    logs.forEach(log => {
      const endpoint = log.endpoint || 'unknown';
      if (!byEndpoint[endpoint]) byEndpoint[endpoint] = { cost: 0, calls: 0 };
      byEndpoint[endpoint].cost += log.cost_usd || 0;
      byEndpoint[endpoint].calls += 1;
    });
    
    // By blog
    const byBlog: Record<string, { cost: number; calls: number; lastCall: string }> = {};
    logs.forEach(log => {
      if (!log.blog_id) return;
      if (!byBlog[log.blog_id]) byBlog[log.blog_id] = { cost: 0, calls: 0, lastCall: log.created_at };
      byBlog[log.blog_id].cost += log.cost_usd || 0;
      byBlog[log.blog_id].calls += 1;
      if (log.created_at > byBlog[log.blog_id].lastCall) {
        byBlog[log.blog_id].lastCall = log.created_at;
      }
    });
    
    // Timeline data
    const dailyData: Record<string, { date: string; perplexity: number; fallback: number }> = {};
    logs.forEach(log => {
      const date = format(new Date(log.created_at), 'yyyy-MM-dd');
      if (!dailyData[date]) dailyData[date] = { date, perplexity: 0, fallback: 0 };
      if (log.provider === 'perplexity') {
        dailyData[date].perplexity += log.cost_usd || 0;
      } else {
        dailyData[date].fallback += log.cost_usd || 0;
      }
    });
    
    return {
      totalCost,
      totalCalls,
      successfulCalls,
      uniqueBlogs,
      costPerBlog,
      byProvider: Object.entries(byProvider).map(([provider, data]) => ({ provider, ...data })),
      byEndpoint: Object.entries(byEndpoint).map(([endpoint, data]) => ({ endpoint, ...data })),
      byBlog: Object.entries(byBlog).map(([blogId, data]) => ({ 
        blogId, 
        blogName: blogNames[blogId] || blogId.substring(0, 8) + '...',
        ...data 
      })).sort((a, b) => b.cost - a.cost),
      timeline: Object.values(dailyData).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }, [logs, blogNames]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
          <Globe className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Custos Perplexity / Market Intel</h2>
          <p className="text-sm text-muted-foreground">
            Monitoramento de uso da API de inteligência de mercado
          </p>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              ${summaries.totalCost.toFixed(4)}
            </div>
            <p className="text-xs text-muted-foreground">No período selecionado</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chamadas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaries.totalCalls}</div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="text-xs gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {summaries.successfulCalls}
              </Badge>
              {summaries.totalCalls - summaries.successfulCalls > 0 && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  {summaries.totalCalls - summaries.successfulCalls}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Blogs Ativos</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaries.uniqueBlogs}</div>
            <p className="text-xs text-muted-foreground">Com chamadas no período</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Custo/Blog</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summaries.costPerBlog.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">Média por subconta</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProviderDistributionChart data={summaries.byProvider} />
        <EndpointCostsChart data={summaries.byEndpoint} />
      </div>
      
      {/* Timeline Chart */}
      {summaries.timeline.length > 0 && (
        <MarketIntelTimelineChart data={summaries.timeline} />
      )}
      
      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Blog Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consumo por Subconta</CardTitle>
            <CardDescription>Ranking de blogs por custo</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Blog</TableHead>
                  <TableHead className="text-right">Chamadas</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.byBlog.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Nenhum consumo no período
                    </TableCell>
                  </TableRow>
                ) : (
                  summaries.byBlog.slice(0, 10).map((item) => (
                    <TableRow key={item.blogId}>
                      <TableCell className="font-medium">{item.blogName}</TableCell>
                      <TableCell className="text-right">{item.calls}</TableCell>
                      <TableCell className="text-right">${item.cost.toFixed(4)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        
        {/* Recent Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logs Recentes</CardTitle>
            <CardDescription>Últimas chamadas à API</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhum log no período
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.slice(0, 10).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs">{log.endpoint}</TableCell>
                      <TableCell>
                        <Badge variant={log.provider === 'perplexity' ? 'default' : 'secondary'}>
                          {log.provider}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">${(log.cost_usd || 0).toFixed(4)}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'dd/MM HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
