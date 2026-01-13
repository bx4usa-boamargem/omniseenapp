import { useState, useEffect } from 'react';
import { ExternalLink, ArrowUpRight, ArrowDownRight, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface PageData {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  clicksDelta?: number;
  impressionsDelta?: number;
  positionDelta?: number;
}

interface SearchConsoleTableProps {
  blogId: string;
  period: '7d' | '30d' | '90d';
}

type SortField = 'clicks' | 'impressions' | 'ctr' | 'position';
type SortDirection = 'asc' | 'desc';

export function SearchConsoleTable({ blogId, period }: SearchConsoleTableProps) {
  const [pages, setPages] = useState<PageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState<string>('5');
  const [sortField, setSortField] = useState<SortField>('clicks');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    fetchTopPages();
  }, [blogId, period]);

  const fetchTopPages = async () => {
    if (!blogId) return;
    setLoading(true);

    try {
      const daysAgo = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      const { data, error } = await supabase
        .from('gsc_pages_history')
        .select('page_url, clicks, impressions, ctr, position, date')
        .eq('blog_id', blogId)
        .gte('date', startDate.toISOString().split('T')[0])
        .order('clicks', { ascending: false });

      if (error) throw error;

      // Aggregate by page
      const pageMap = new Map<string, { 
        clicks: number; 
        impressions: number; 
        positions: number[];
        count: number;
      }>();

      data?.forEach(row => {
        const existing = pageMap.get(row.page_url) || { 
          clicks: 0, 
          impressions: 0, 
          positions: [],
          count: 0
        };
        pageMap.set(row.page_url, {
          clicks: existing.clicks + (row.clicks || 0),
          impressions: existing.impressions + (row.impressions || 0),
          positions: [...existing.positions, row.position || 0],
          count: existing.count + 1
        });
      });

      const aggregatedPages: PageData[] = Array.from(pageMap.entries()).map(([page, data]) => {
        const avgPosition = data.positions.length > 0 
          ? data.positions.reduce((a, b) => a + b, 0) / data.positions.length 
          : 0;
        const ctr = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;
        
        return {
          page,
          clicks: data.clicks,
          impressions: data.impressions,
          ctr,
          position: avgPosition
        };
      });

      setPages(aggregatedPages);
    } catch (error) {
      console.error('Error fetching top pages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortedPages = [...pages].sort((a, b) => {
    const multiplier = sortDirection === 'desc' ? -1 : 1;
    return (a[sortField] - b[sortField]) * multiplier;
  }).slice(0, parseInt(limit));

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'desc' 
      ? <ChevronDown className="h-3 w-3 ml-1" />
      : <ChevronUp className="h-3 w-3 ml-1" />;
  };

  const DeltaIndicator = ({ value, inverted = false }: { value?: number; inverted?: boolean }) => {
    if (value === undefined || Math.abs(value) < 0.01) return null;
    
    const isPositive = inverted ? value < 0 : value > 0;
    
    return (
      <span className={cn(
        "flex items-center text-xs ml-1",
        isPositive ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"
      )}>
        {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  const formatPageUrl = (url: string) => {
    try {
      const path = new URL(url).pathname;
      return path.length > 40 ? path.substring(0, 40) + '...' : path;
    } catch {
      return url.length > 40 ? url.substring(0, 40) + '...' : url;
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="text-sm font-medium text-foreground">
          Páginas com Maior Tráfego
        </h3>
        <Select value={limit} onValueChange={setLimit}>
          <SelectTrigger className="w-24 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">Top 5</SelectItem>
            <SelectItem value="10">Top 10</SelectItem>
            <SelectItem value="20">Top 20</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-medium text-muted-foreground">
                Página
              </TableHead>
              <TableHead 
                className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground text-right"
                onClick={() => handleSort('clicks')}
              >
                <span className="flex items-center justify-end">
                  Cliques
                  <SortIcon field="clicks" />
                </span>
              </TableHead>
              <TableHead 
                className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground text-right"
                onClick={() => handleSort('impressions')}
              >
                <span className="flex items-center justify-end">
                  Impressões
                  <SortIcon field="impressions" />
                </span>
              </TableHead>
              <TableHead 
                className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground text-right"
                onClick={() => handleSort('ctr')}
              >
                <span className="flex items-center justify-end">
                  CTR
                  <SortIcon field="ctr" />
                </span>
              </TableHead>
              <TableHead 
                className="text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground text-right"
                onClick={() => handleSort('position')}
              >
                <span className="flex items-center justify-end">
                  Posição
                  <SortIcon field="position" />
                </span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhum dado de páginas disponível para o período selecionado
                </TableCell>
              </TableRow>
            ) : (
              sortedPages.map((page, index) => (
                <TableRow key={index} className="group">
                  <TableCell className="font-mono text-sm">
                    <a 
                      href={page.page} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-foreground hover:text-primary transition-colors"
                    >
                      {formatPageUrl(page.page)}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="flex items-center justify-end">
                      <span className="font-medium">{page.clicks.toLocaleString('pt-BR')}</span>
                      <DeltaIndicator value={page.clicksDelta} />
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="flex items-center justify-end">
                      <span className="font-medium">{page.impressions.toLocaleString('pt-BR')}</span>
                      <DeltaIndicator value={page.impressionsDelta} />
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {page.ctr.toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="flex items-center justify-end">
                      <span className="font-medium">{page.position.toFixed(1)}</span>
                      <DeltaIndicator value={page.positionDelta} inverted />
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
