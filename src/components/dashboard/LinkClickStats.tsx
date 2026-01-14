import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, Copy, ExternalLink, QrCode, Loader2 } from 'lucide-react';

interface LinkClickStatsProps {
  blogId: string;
}

interface Stats {
  total: number;
  linkCopy: number;
  linkOpen: number;
  qrDownload: number;
}

export function LinkClickStats({ blogId }: LinkClickStatsProps) {
  const [stats, setStats] = useState<Stats>({ total: 0, linkCopy: 0, linkOpen: 0, qrDownload: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!blogId) return;

    const fetchStats = async () => {
      try {
        const { data, error } = await supabase
          .from('link_click_events')
          .select('event_type')
          .eq('blog_id', blogId);

        if (error) throw error;

        const statsData: Stats = {
          total: data?.length || 0,
          linkCopy: data?.filter(e => e.event_type === 'link_copy').length || 0,
          linkOpen: data?.filter(e => e.event_type === 'link_open').length || 0,
          qrDownload: data?.filter(e => e.event_type === 'qr_download').length || 0,
        };

        setStats(statsData);
      } catch (error) {
        console.error('Error fetching link stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [blogId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-primary" />
          Estatísticas do Link Público
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-primary/5 rounded-lg">
            <div className="text-3xl font-bold text-primary">{stats.total}</div>
            <div className="text-sm text-muted-foreground mt-1">Total de Ações</div>
          </div>
          <div className="text-center p-4 bg-blue-500/5 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Copy className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.linkCopy}</div>
            <div className="text-sm text-muted-foreground">Cópias</div>
          </div>
          <div className="text-center p-4 bg-green-500/5 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <ExternalLink className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.linkOpen}</div>
            <div className="text-sm text-muted-foreground">Acessos</div>
          </div>
          <div className="text-center p-4 bg-purple-500/5 rounded-lg">
            <div className="flex items-center justify-center gap-2 mb-1">
              <QrCode className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.qrDownload}</div>
            <div className="text-sm text-muted-foreground">QR Downloads</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Acompanhe quantas vezes seu link público foi copiado, acessado ou baixado como QR Code.
        </p>
      </CardContent>
    </Card>
  );
}
