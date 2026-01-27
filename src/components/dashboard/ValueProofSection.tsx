import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Eye, Target, MessageSquare, ArrowRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { subDays, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface ValueProofSectionProps {
  blogId: string | undefined;
}

interface MetricCardProps {
  icon: React.ElementType;
  emoji: string;
  label: string;
  value: number | string;
  subtext?: string;
  loading?: boolean;
  iconColor?: string;
  iconBg?: string;
}

function MetricCard({ icon: Icon, emoji, label, value, subtext, loading, iconColor, iconBg }: MetricCardProps) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-accent/30 border border-border/50">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-lg', iconBg || 'bg-primary/10')}>
        {emoji}
      </div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1" />
        ) : (
          <>
            <p className="text-xl font-bold text-foreground">{value}</p>
            {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
          </>
        )}
      </div>
    </div>
  );
}

export function ValueProofSection({ blogId }: ValueProofSectionProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    visitsTotal: 0,
    ctaClicks: 0,
    realLeads: 0,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!blogId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const sevenDaysAgo = startOfDay(subDays(new Date(), 7));

        // Fetch total views from articles
        const { data: articles } = await supabase
          .from('articles')
          .select('view_count')
          .eq('blog_id', blogId);

        const visitsTotal = articles?.reduce((sum, a) => sum + (a.view_count || 0), 0) || 0;

        // Fetch CTA clicks (whatsapp_click, phone_click from real_leads)
        const { count: ctaClicks } = await supabase
          .from('real_leads')
          .select('*', { count: 'exact', head: true })
          .eq('blog_id', blogId)
          .in('lead_type', ['whatsapp_click', 'phone_click'])
          .gte('created_at', sevenDaysAgo.toISOString());

        // Fetch real leads (form_submit)
        const { count: realLeads } = await supabase
          .from('real_leads')
          .select('*', { count: 'exact', head: true })
          .eq('blog_id', blogId)
          .eq('lead_type', 'form_submit')
          .gte('created_at', sevenDaysAgo.toISOString());

        setMetrics({
          visitsTotal,
          ctaClicks: ctaClicks || 0,
          realLeads: realLeads || 0,
        });
      } catch (error) {
        console.error('Error fetching value proof metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [blogId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Prova de Valor</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Últimos 7 dias vs período anterior</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/client/leads')} className="gap-1 text-primary">
            Ver detalhes
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard
            icon={Eye}
            emoji="👁"
            label="Visitas Totais"
            value={metrics.visitsTotal}
            loading={loading}
            iconBg="bg-blue-500/10"
          />
          <MetricCard
            icon={Target}
            emoji="🎯"
            label="Cliques nos CTAs"
            value={metrics.ctaClicks}
            loading={loading}
            iconBg="bg-orange-500/10"
          />
          <MetricCard
            icon={MessageSquare}
            emoji="💬"
            label="Leads Reais"
            value={metrics.realLeads}
            loading={loading}
            iconBg="bg-green-500/10"
          />
        </div>
      </CardContent>
    </Card>
  );
}
