import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface MarketIntel {
  id: string;
  week_of: string;
  source: string;
  market_snapshot: string;
  trends: Array<{ topic: string; why_trending: string; growth_signal: string; sources: string[] }>;
  questions: Array<{ question: string; intent: string; audience_pain: string }>;
  keywords: Array<{ keyword: string; context: string }>;
  competitor_gaps: Array<{ competitor_topic: string; who_is_using_it: string; gap_opportunity: string }>;
  content_ideas: Array<{ title: string; angle: string; keywords: string[]; goal: string; why_now: string; sources: string[] }>;
}

interface AggregatedData {
  trends: Array<{ topic: string; why_trending: string; growth_signal: string; sources: string[] }>;
  questions: Array<{ question: string; intent: string; audience_pain: string }>;
  keywords: Array<{ keyword: string; context: string }>;
  gaps: Array<{ competitor_topic: string; who_is_using_it: string; gap_opportunity: string }>;
  ideas: Array<{ title: string; angle: string; keywords: string[]; goal: string; why_now: string; sources: string[] }>;
  latestSnapshot: string | null;
  latestDate: string | null;
}

interface MarketIntelExportProps {
  data: AggregatedData;
  intels: MarketIntel[];
}

export function MarketIntelExport({ data, intels }: MarketIntelExportProps) {
  const [exporting, setExporting] = useState(false);
  
  const exportJSON = () => {
    setExporting(true);
    try {
      const exportData = {
        exported_at: new Date().toISOString(),
        market_snapshot: data.latestSnapshot,
        latest_week: data.latestDate,
        trends: data.trends,
        questions: data.questions,
        keywords: data.keywords,
        competitor_gaps: data.gaps,
        content_ideas: data.ideas,
        raw_intels: intels.map(intel => ({
          week_of: intel.week_of,
          source: intel.source,
          market_snapshot: intel.market_snapshot,
        })),
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `market-intel-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('JSON exportado com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar JSON');
    }
    setExporting(false);
  };
  
  const exportCSV = () => {
    setExporting(true);
    try {
      // Export content ideas as CSV
      const headers = ['Título', 'Ângulo', 'Objetivo', 'Keywords', 'Por que agora', 'Fontes'];
      const rows = data.ideas.map(idea => [
        `"${idea.title.replace(/"/g, '""')}"`,
        idea.angle,
        idea.goal,
        `"${(idea.keywords || []).join(', ')}"`,
        `"${(idea.why_now || '').replace(/"/g, '""')}"`,
        `"${(idea.sources || []).join(', ')}"`,
      ]);
      
      const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `content-ideas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('CSV exportado com sucesso!');
    } catch (error) {
      toast.error('Erro ao exportar CSV');
    }
    setExporting(false);
  };
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting} className="gap-2">
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportJSON} className="gap-2">
          <FileJson className="h-4 w-4" />
          Exportar JSON (Completo)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportCSV} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Exportar CSV (Ideias)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
