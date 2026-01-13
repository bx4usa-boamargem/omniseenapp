import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Target, Sparkles, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface Competitor {
  id: string;
  name: string;
  url: string;
  favicon_url?: string;
}

interface Gap {
  id: string;
  suggested_title: string;
  suggested_keywords: string[];
  why_now: string;
  relevance_score: number;
  funnel_stage: string;
  status: string;
  created_at: string;
}

interface CompetitorGapsModalProps {
  competitor: Competitor;
  blogId: string;
  open: boolean;
  onClose: () => void;
  onGapConverted?: () => void;
}

export function CompetitorGapsModal({ 
  competitor, 
  blogId, 
  open, 
  onClose,
  onGapConverted 
}: CompetitorGapsModalProps) {
  const navigate = useNavigate();
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchGaps();
    }
  }, [open, competitor.id]);

  const fetchGaps = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('article_opportunities')
        .select('*')
        .eq('blog_id', blogId)
        .eq('competitor_id', competitor.id)
        .neq('status', 'converted')
        .order('relevance_score', { ascending: false });

      if (error) throw error;
      setGaps(data || []);
    } catch (error) {
      console.error('Error fetching gaps:', error);
      toast.error('Erro ao carregar gaps');
    }
    setLoading(false);
  };

  // IMMEDIATE REDIRECT - No waiting for edge function
  const handleCreateArticle = (gap: Gap) => {
    // Navigate immediately to editor with auto-run params
    const params = new URLSearchParams({
      quick: 'true',
      fromOpportunity: gap.id,
      theme: gap.suggested_title,
      mode: 'fast',
      images: '1'
    });
    
    onGapConverted?.();
    onClose();
    navigate(`/client/create?${params.toString()}`);
  };

  const getFunnelLabel = (stage: string) => {
    switch (stage) {
      case 'top': return { label: 'Topo', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
      case 'middle': return { label: 'Meio', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' };
      case 'bottom': return { label: 'Fundo', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
      default: return { label: 'Topo', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-gray-500';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {competitor.favicon_url && (
              <img 
                src={competitor.favicon_url} 
                alt="" 
                className="w-8 h-8 rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <div>
              <DialogTitle>Gaps de {competitor.name}</DialogTitle>
              <DialogDescription>
                Temas que {competitor.name} cobre e você ainda não
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : gaps.length === 0 ? (
            <div className="text-center py-12">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium text-lg mb-2">Nenhum gap pendente</h3>
              <p className="text-muted-foreground">
                Todos os gaps deste concorrente já foram convertidos em artigos ou não há gaps identificados.
              </p>
              <Button variant="outline" className="mt-4" onClick={onClose}>
                Fechar
              </Button>
            </div>
          ) : (
            gaps.map(gap => {
              const funnel = getFunnelLabel(gap.funnel_stage);
              return (
                <Card key={gap.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={funnel.color} variant="secondary">
                            {funnel.label}
                          </Badge>
                          <span className={`text-sm font-medium ${getScoreColor(gap.relevance_score)}`}>
                            {gap.relevance_score}% relevância
                          </span>
                        </div>
                        
                        <h4 className="font-medium text-base mb-2 line-clamp-2">
                          {gap.suggested_title}
                        </h4>
                        
                        {gap.why_now && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {gap.why_now}
                          </p>
                        )}
                        
                        <div className="flex flex-wrap gap-1.5">
                          {gap.suggested_keywords?.slice(0, 4).map(kw => (
                            <Badge 
                              key={kw} 
                              variant="outline" 
                              className="text-xs bg-muted/50"
                            >
                              {kw}
                            </Badge>
                          ))}
                          {(gap.suggested_keywords?.length || 0) > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{gap.suggested_keywords.length - 4}
                            </Badge>
                          )}
                        </div>
                      </div>
                      
                      <Button 
                        size="sm"
                        onClick={() => handleCreateArticle(gap)}
                        disabled={converting === gap.id}
                        className="shrink-0"
                      >
                        {converting === gap.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <FileText className="h-4 w-4 mr-1.5" />
                            Criar Artigo
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {gaps.length > 0 && (
          <div className="pt-4 border-t mt-4">
            <p className="text-sm text-muted-foreground text-center">
              {gaps.length} {gaps.length === 1 ? 'oportunidade pendente' : 'oportunidades pendentes'}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
