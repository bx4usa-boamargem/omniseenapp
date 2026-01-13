import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScoreStars } from './ScoreStars';
import { FileText, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface Opportunity {
  id: string;
  suggested_title: string;
  relevance_score: number;
  suggested_keywords?: string[];
  status: string;
  blog_id?: string;
}

interface TopOpportunitiesTableProps {
  opportunities: Opportunity[];
  maxItems?: number;
  blogId?: string;
}

export function TopOpportunitiesTable({ 
  opportunities, 
  maxItems = 5,
  blogId 
}: TopOpportunitiesTableProps) {
  const navigate = useNavigate();

  // Filter unconverted, sort by score, take top N
  const topOpportunities = opportunities
    .filter(o => o.status !== 'converted')
    .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
    .slice(0, maxItems);

  // IMMEDIATE REDIRECT - No waiting for edge function
  const handleCreateArticle = (opportunity: Opportunity) => {
    const effectiveBlogId = blogId || opportunity.blog_id;
    if (!effectiveBlogId) {
      toast.error('Blog não identificado. Tente novamente.');
      return;
    }
    
    // Navigate immediately to editor with auto-run params
    const params = new URLSearchParams({
      quick: 'true',
      fromOpportunity: opportunity.id,
      theme: opportunity.suggested_title,
      mode: 'fast',
      images: '1'
    });
    
    navigate(`/client/create?${params.toString()}`);
  };

  if (topOpportunities.length === 0) {
    return (
      <Card className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            ⭐ Top Oportunidades de Alto Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Nenhuma oportunidade de alto score pendente</p>
            <p className="text-sm mt-1">O Consultor Comercial gerará novas oportunidades em breve.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          ⭐ Top {maxItems} Oportunidades de Alto Score (Não Convertidas)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {topOpportunities.map((opportunity, index) => (
          <div 
            key={opportunity.id}
            className="p-4 rounded-lg bg-gray-50 dark:bg-white/5 border border-slate-200 dark:border-white/10"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg font-bold text-primary">#{index + 1}</span>
                  <ScoreStars score={opportunity.relevance_score || 0} size="sm" />
                </div>
                <h4 className="font-medium text-gray-900 dark:text-white line-clamp-2">
                  {opportunity.suggested_title}
                </h4>
                {opportunity.suggested_keywords && opportunity.suggested_keywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {opportunity.suggested_keywords.slice(0, 4).map((keyword, i) => (
                      <span 
                        key={i}
                        className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Button 
                size="sm" 
                className="shrink-0 gap-2"
                onClick={() => handleCreateArticle(opportunity)}
              >
                <ExternalLink className="h-4 w-4" />
                Criar Artigo
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
