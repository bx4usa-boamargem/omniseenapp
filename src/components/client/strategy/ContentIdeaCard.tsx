import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Lightbulb, BookOpen, MapPin, Award, Target, Users, Zap,
  ExternalLink, ArrowRight, Clock, Loader2
} from 'lucide-react';

interface ContentIdeaCardProps {
  title: string;
  angle: string;
  keywords: string[];
  goal: string;
  why_now: string;
  sources: string[];
  blogId: string;
  opportunityId?: string;
  intelWeekId?: string; // ID do pacote de inteligência semanal para rastreabilidade
}

const angleConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  educational: { 
    label: 'Educacional', 
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
    icon: BookOpen
  },
  seo_local: { 
    label: 'SEO Local', 
    color: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
    icon: MapPin
  },
  authority: { 
    label: 'Autoridade', 
    color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
    icon: Award
  },
};

const goalConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  lead: { 
    label: 'Gerar Lead', 
    color: 'bg-green-500/10 text-green-700 dark:text-green-400',
    icon: Target
  },
  authority: { 
    label: 'Autoridade', 
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    icon: Award
  },
  conversion: { 
    label: 'Conversão', 
    color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
    icon: Zap
  },
  awareness: { 
    label: 'Awareness', 
    color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    icon: Users
  },
};

export function ContentIdeaCard({
  title,
  angle,
  keywords,
  goal,
  why_now,
  sources,
  blogId,
  opportunityId,
  intelWeekId
}: ContentIdeaCardProps) {
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const validateBlogPermission = async (userId: string): Promise<boolean> => {
    // Check if user owns the blog
    const { data: blogCheck } = await supabase
      .from('blogs')
      .select('id, user_id')
      .eq('id', blogId)
      .single();

    if (blogCheck?.user_id === userId) {
      return true;
    }

    // Check if user is team member
    const { data: membership } = await supabase
      .from('team_members')
      .select('id')
      .eq('blog_id', blogId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    if (membership) {
      return true;
    }

    // Check if user is admin
    const { data: adminRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'platform_admin'])
      .maybeSingle();

    return !!adminRole;
  };
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  
  const angleConf = angleConfig[angle] || angleConfig.educational;
  const goalConf = goalConfig[goal] || goalConfig.lead;
  const AngleIcon = angleConf.icon;
  const GoalIcon = goalConf.icon;
  
  // Mapear goal para article_goal (valores aceitos pelo banco)
  const goalMap: Record<string, string> = {
    'lead': 'educar',
    'authority': 'autoridade',
    'conversion': 'converter',
    'awareness': 'educar'
  };
  
  // Mapear goal para funnel_stage
  const funnelMap: Record<string, string> = {
    'lead': 'topo',
    'authority': 'meio',
    'conversion': 'fundo',
    'awareness': 'topo'
  };
  
  const handleCreateArticle = async () => {
    if (creating) return;
    setCreating(true);
    toast.info('Criando artigo a partir da ideia...');
    
    try {
      // Se temos opportunityId, usar conversão direta via edge function
      if (opportunityId) {
        const { data, error } = await supabase.functions.invoke(
          'convert-opportunity-to-article',
          { body: { opportunityId, blogId } }
        );
        
        if (error || !data?.success) {
          throw new Error(data?.error || 'Erro na conversão');
        }
        
        console.log('[RADAR->ARTICLE] converted opportunity_id=', opportunityId, 'to article_id=', data.article_id);
        toast.success('Artigo criado com sucesso!');
        navigate(`/client/articles/${data.article_id}/edit`);
        return;
      }
      
      // Criar artigo diretamente a partir da ideia do Radar (sem opportunityId)
      // 1. Verificar idempotência - se já existe artigo com título similar
      const { data: existing } = await supabase
        .from('articles')
        .select('id')
        .eq('blog_id', blogId)
        .ilike('title', title)
        .limit(1)
        .maybeSingle();

      if (existing) {
        console.log('[RADAR->ARTICLE] loaded existing article_id=', existing.id);
        toast.info('Artigo já existe, abrindo editor...');
        navigate(`/client/articles/${existing.id}/edit`);
        return;
      }

      // 2. Criar payload de origem para rastreabilidade completa
      const sourcePayload = {
        angle,
        why_now,
        sources,
        keywords,
        original_goal: goal,
        created_from: 'radar_idea'
      };

      // 3. Gerar slug único a partir do título
      const slug = title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 80) + '-' + Date.now().toString(36);

      // 4. Inserir artigo real com status draft
      const { data: article, error: insertError } = await supabase
        .from('articles')
        .insert({
          blog_id: blogId,
          title: title,
          slug: slug,
          keywords: keywords,
          status: 'draft',
          generation_source: 'radar',
          article_goal: goalMap[goal] || 'educar',
          funnel_stage: funnelMap[goal] || 'topo',
          source_payload: sourcePayload,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[RADAR->ARTICLE] insert error:', insertError);
        throw insertError;
      }

      console.log('[RADAR->ARTICLE] created article_id=', article.id);
      toast.success('Artigo criado com sucesso!');
      navigate(`/client/articles/${article.id}/edit`);
      
    } catch (err) {
      console.error('[ContentIdeaCard] Convert error:', err);
      toast.error('Erro ao criar artigo. Tente novamente.');
    } finally {
      setCreating(false);
    }
  };
  
  return (
    <Card className="hover:shadow-md transition-shadow group">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-1.5 rounded-lg bg-amber-500/10 shrink-0 mt-0.5">
            <Lightbulb className="h-4 w-4 text-amber-600" />
          </div>
          <h4 className="font-semibold text-sm leading-relaxed flex-1">
            {title}
          </h4>
        </div>
        
        {/* Badges */}
        <div className="flex flex-wrap gap-2 mb-3">
          <Badge variant="outline" className={`text-xs ${angleConf.color}`}>
            <AngleIcon className="h-3 w-3 mr-1" />
            {angleConf.label}
          </Badge>
          <Badge variant="outline" className={`text-xs ${goalConf.color}`}>
            <GoalIcon className="h-3 w-3 mr-1" />
            {goalConf.label}
          </Badge>
        </div>
        
        {/* Keywords */}
        {keywords && keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {keywords.slice(0, 4).map((kw, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {kw}
              </Badge>
            ))}
            {keywords.length > 4 && (
              <Badge variant="secondary" className="text-xs">
                +{keywords.length - 4}
              </Badge>
            )}
          </div>
        )}
        
        {/* Why Now */}
        {why_now && (
          <div className="p-2.5 bg-orange-500/5 border border-orange-500/20 rounded-lg mb-3">
            <p className="text-xs text-orange-700 dark:text-orange-400 flex items-start gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span><span className="font-medium">Por que agora:</span> {why_now}</span>
            </p>
          </div>
        )}
        
        {/* Sources */}
        {sources && sources.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-muted-foreground">Fontes:</span>
            <div className="flex gap-1">
              {sources.slice(0, 2).map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 hover:bg-muted rounded transition-colors"
                  title={url}
                >
                  <ExternalLink className="h-3 w-3 text-primary" />
                </a>
              ))}
            </div>
          </div>
        )}
        
        {/* Create Article Button */}
        <Button 
          onClick={handleCreateArticle} 
          disabled={creating}
          size="sm" 
          className="w-full gap-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Criar Artigo
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
