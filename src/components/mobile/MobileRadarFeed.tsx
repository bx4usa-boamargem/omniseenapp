import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Compass, 
  MapPin, 
  Flame, 
  Loader2,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Opportunity {
  id: string;
  suggested_title: string;
  relevance_score: number | null;
  suggested_keywords: string[] | null;
  status: string | null;
  created_at: string | null;
  territory_id: string | null;
  territory?: {
    city: string | null;
    state: string | null;
  };
}

interface MobileRadarFeedProps {
  blogId: string;
}

export function MobileRadarFeed({ blogId }: MobileRadarFeedProps) {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const fetchOpportunities = useCallback(async () => {
    if (!blogId) return;

    // Filter for last 30 days only
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    try {
      const { data, error } = await supabase
        .from('article_opportunities')
        .select(`
          id,
          suggested_title,
          relevance_score,
          suggested_keywords,
          status,
          created_at,
          territory_id,
          territories:territory_id (
            city,
            state
          )
        `)
        .eq('blog_id', blogId)
        .eq('status', 'pending')
        .gte('created_at', cutoffDate)
        .order('relevance_score', { ascending: false, nullsFirst: false })
        .limit(20);

      if (error) throw error;

      const mapped = (data || []).map(item => ({
        ...item,
        territory: Array.isArray(item.territories) ? item.territories[0] : item.territories,
      }));

      setOpportunities(mapped);
    } catch (error) {
      console.error('Error fetching opportunities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [blogId]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOpportunities();
  };

  const handleGenerateArticle = async (opportunity: Opportunity) => {
    setGeneratingId(opportunity.id);
    
    // Navigate to creation page with quick mode
    navigate(`/client/articles/engine/new?quick=true&fromOpportunity=${opportunity.id}`);
  };

  const getOpportunityLevel = (score: number | null) => {
    if (!score) return { label: 'Normal', color: 'bg-gray-500/20 text-gray-600', icon: null };
    if (score >= 90) return { label: 'Alta busca', color: 'bg-red-500/20 text-red-600', icon: Flame };
    if (score >= 70) return { label: 'Média', color: 'bg-yellow-500/20 text-yellow-600', icon: null };
    return { label: 'Normal', color: 'bg-gray-500/20 text-gray-600', icon: null };
  };

  if (loading) {
    return (
      <div className="space-y-4 pb-24">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Compass className="h-6 w-6 text-primary" />
            Radar
          </h1>
        </div>
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Compass className="h-6 w-6 text-primary" />
          Radar
        </h1>
        <Button 
          variant="ghost" 
          size="icon"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Oportunidades detectadas para o seu negócio
      </p>

      {/* Empty State */}
      {opportunities.length === 0 && (
        <div className="text-center py-12">
          <Compass className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Nenhuma oportunidade pendente</p>
          <p className="text-sm text-muted-foreground mt-1">
            O Radar analisa o mercado semanalmente
          </p>
        </div>
      )}

      {/* Opportunity Feed - Vertical infinite scroll style */}
      <div className="space-y-3">
        {opportunities.map((opportunity) => {
          const level = getOpportunityLevel(opportunity.relevance_score);
          const LevelIcon = level.icon;
          const isGenerating = generatingId === opportunity.id;

          return (
            <div
              key={opportunity.id}
              className="bg-card rounded-xl border border-border p-4 space-y-3"
            >
              {/* Title */}
              <h3 className="font-semibold text-foreground text-base leading-snug">
                {opportunity.suggested_title}
              </h3>

              {/* Territory & Level */}
              <div className="flex items-center gap-2 flex-wrap">
                {opportunity.territory?.city && (
                  <Badge variant="outline" className="gap-1 text-xs">
                    <MapPin className="h-3 w-3" />
                    {opportunity.territory.city}
                    {opportunity.territory.state && `, ${opportunity.territory.state}`}
                  </Badge>
                )}
                <Badge className={`${level.color} gap-1 text-xs`}>
                  {LevelIcon && <LevelIcon className="h-3 w-3" />}
                  {level.label}
                </Badge>
              </div>

              {/* Keywords */}
              {opportunity.suggested_keywords && opportunity.suggested_keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {opportunity.suggested_keywords.slice(0, 3).map((keyword, idx) => (
                    <span 
                      key={idx}
                      className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              )}

              {/* CTA Button */}
              <Button
                onClick={() => handleGenerateArticle(opportunity)}
                disabled={isGenerating}
                className="w-full h-12 text-base gap-2 client-btn-primary"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Gerar artigo
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
