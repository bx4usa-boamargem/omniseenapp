import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Lightbulb, Loader2, TrendingUp, Target, Sparkles, 
  Search, Check, Archive, RotateCcw, Star, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

interface Opportunity {
  id: string;
  suggested_title: string;
  suggested_keywords: string[] | null;
  relevance_score: number | null;
  source: string | null;
  status: string | null;
  trend_source?: string | null;
  created_at: string;
}

interface ClientOpportunitiesTabProps {
  blogId: string;
}

type SourceFilter = 'all' | 'trends' | 'competitor_gaps' | 'ai';

export function ClientOpportunitiesTab({ blogId }: ClientOpportunitiesTabProps) {
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingMode, setGeneratingMode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');

  useEffect(() => {
    fetchOpportunities();
  }, [blogId]);

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('article_opportunities')
        .select('*')
        .eq('blog_id', blogId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOpportunities(data || []);
    } catch (error) {
      console.error('Error fetching opportunities:', error);
    }
    setLoading(false);
  };

  const handleGenerate = async (mode: 'standard' | 'trends' | 'competitor_gaps') => {
    setGenerating(true);
    setGeneratingMode(mode);

    try {
      const { data, error } = await supabase.functions.invoke('generate-opportunities', {
        body: { 
          blogId, 
          count: 5,
          mode,
          useTrends: mode === 'trends'
        }
      });

      if (error) throw error;

      toast.success('Oportunidades geradas!', {
        description: `${data?.count || 0} novas sugestões de artigos.`
      });

      fetchOpportunities();
    } catch (error) {
      console.error('Error generating opportunities:', error);
      toast.error('Erro ao gerar oportunidades');
    }

    setGenerating(false);
    setGeneratingMode(null);
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'archived' | 'pending') => {
    try {
      const { error } = await supabase
        .from('article_opportunities')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      setOpportunities(prev => 
        prev.map(o => o.id === id ? { ...o, status } : o)
      );

      const messages: Record<string, string> = {
        approved: 'Oportunidade aprovada!',
        archived: 'Oportunidade arquivada',
        pending: 'Oportunidade restaurada'
      };
      toast.success(messages[status]);
    } catch (error) {
      console.error('Error updating opportunity:', error);
      toast.error('Erro ao atualizar');
    }
  };

  const handleCreateArticle = (opportunity: Opportunity) => {
    const params = new URLSearchParams({
      title: opportunity.suggested_title,
      keywords: opportunity.suggested_keywords?.join(',') || '',
      opportunityId: opportunity.id
    });
    navigate(`/client/create?${params.toString()}`);
  };

  const getSourceBadge = (source: string | null) => {
    switch (source) {
      case 'trends':
        return (
          <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400">
            <TrendingUp className="h-3 w-3 mr-1" />
            Tendência Real
          </Badge>
        );
      case 'competitor_gaps':
        return (
          <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Target className="h-3 w-3 mr-1" />
            Gap de Concorrente
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Sparkles className="h-3 w-3 mr-1" />
            IA
          </Badge>
        );
    }
  };

  const getScoreStars = (score: number | null) => {
    if (!score) return null;
    const stars = Math.round((score / 100) * 5);
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star 
            key={i} 
            className={`h-3 w-3 ${i < stars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
          />
        ))}
      </div>
    );
  };

  const filteredOpportunities = opportunities.filter(o => {
    const matchesSearch = o.suggested_title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSource = sourceFilter === 'all' || o.source === sourceFilter;
    return matchesSearch && matchesSource;
  });

  const pendingOpportunities = filteredOpportunities.filter(o => o.status === 'pending');
  const approvedOpportunities = filteredOpportunities.filter(o => o.status === 'approved');
  const archivedOpportunities = filteredOpportunities.filter(o => o.status === 'archived');

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-amber-500/20">
                <Lightbulb className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Oportunidades de Conteúdo</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Sugestões de artigos baseadas em tendências reais e análise de concorrentes.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                onClick={() => handleGenerate('standard')}
                disabled={generating}
              >
                {generating && generatingMode === 'standard' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Gerar com IA
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleGenerate('trends')}
                disabled={generating}
              >
                {generating && generatingMode === 'trends' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TrendingUp className="h-4 w-4 mr-2" />
                )}
                Tendências
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleGenerate('competitor_gaps')}
                disabled={generating}
              >
                {generating && generatingMode === 'competitor_gaps' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Target className="h-4 w-4 mr-2" />
                )}
                Gaps
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar oportunidades..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filtrar por fonte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fontes</SelectItem>
            <SelectItem value="trends">Tendências</SelectItem>
            <SelectItem value="competitor_gaps">Gaps de Concorrentes</SelectItem>
            <SelectItem value="ai">IA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{pendingOpportunities.length}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
              <div className="p-2 rounded-full bg-amber-500/10">
                <Lightbulb className="h-5 w-5 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{approvedOpportunities.length}</p>
                <p className="text-sm text-muted-foreground">Aprovadas</p>
              </div>
              <div className="p-2 rounded-full bg-green-500/10">
                <Check className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{archivedOpportunities.length}</p>
                <p className="text-sm text-muted-foreground">Arquivadas</p>
              </div>
              <div className="p-2 rounded-full bg-gray-500/10">
                <Archive className="h-5 w-5 text-gray-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Opportunities */}
      {pendingOpportunities.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Pendentes</h3>
          <div className="grid gap-3">
            {pendingOpportunities.map((opportunity) => (
              <Card key={opportunity.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getSourceBadge(opportunity.source)}
                        {getScoreStars(opportunity.relevance_score)}
                      </div>
                      <h4 className="font-medium line-clamp-2">{opportunity.suggested_title}</h4>
                      {opportunity.suggested_keywords && opportunity.suggested_keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {opportunity.suggested_keywords.slice(0, 3).map((kw, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                          {opportunity.suggested_keywords.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{opportunity.suggested_keywords.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleUpdateStatus(opportunity.id, 'archived')}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleUpdateStatus(opportunity.id, 'approved')}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Aprovar
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => handleCreateArticle(opportunity)}
                      >
                        Criar Artigo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Approved Opportunities */}
      {approvedOpportunities.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg text-green-600">Aprovadas</h3>
          <div className="grid gap-3">
            {approvedOpportunities.map((opportunity) => (
              <Card key={opportunity.id} className="border-green-500/30 bg-green-500/5">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getSourceBadge(opportunity.source)}
                      </div>
                      <h4 className="font-medium">{opportunity.suggested_title}</h4>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => handleCreateArticle(opportunity)}
                    >
                      Criar Artigo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Archived Opportunities */}
      {archivedOpportunities.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg text-muted-foreground">Arquivadas</h3>
          <div className="grid gap-3">
            {archivedOpportunities.slice(0, 5).map((opportunity) => (
              <Card key={opportunity.id} className="opacity-60">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <h4 className="font-medium line-clamp-1">{opportunity.suggested_title}</h4>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleUpdateStatus(opportunity.id, 'pending')}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Restaurar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {opportunities.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-2">Nenhuma oportunidade ainda</h3>
              <p className="text-muted-foreground mb-4">
                Gere sugestões de artigos baseadas em tendências ou análise de concorrentes.
              </p>
              <Button onClick={() => handleGenerate('trends')}>
                <TrendingUp className="h-4 w-4 mr-2" />
                Gerar com Tendências
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
