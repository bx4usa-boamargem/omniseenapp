import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Check, 
  ChevronDown, 
  ChevronUp, 
  User, 
  Image, 
  Palette, 
  FileText, 
  MousePointer,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface SetupChecklistProps {
  blogId: string;
  userId: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  tooltip: string;
  icon: React.ReactNode;
  completed: boolean;
  path: string;
}

export function SetupChecklist({ blogId, userId }: SetupChecklistProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [shouldHide, setShouldHide] = useState(false);

  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        // Fetch all required data in parallel
        const [
          blogResult, 
          profileResult, 
          articlesResult,
          strategyResult
        ] = await Promise.all([
          supabase.from('blogs').select('logo_url, primary_color, cta_text, created_at').eq('id', blogId).single(),
          supabase.from('profiles').select('full_name, avatar_url').eq('user_id', userId).single(),
          supabase.from('articles').select('id').eq('blog_id', blogId).eq('status', 'published').limit(1),
          supabase.from('client_strategy').select('id, empresa_nome').eq('blog_id', blogId).maybeSingle()
        ]);

        const blog = blogResult.data;
        const profile = profileResult.data;
        const hasPublishedArticle = (articlesResult.data?.length ?? 0) > 0;
        const strategy = strategyResult.data;

        // Check if blog was created more than 7 days ago
        const blogCreatedAt = blog?.created_at ? new Date(blog.created_at) : new Date();
        const daysSinceCreation = Math.floor((Date.now() - blogCreatedAt.getTime()) / (1000 * 60 * 60 * 24));

        const checklistItems: ChecklistItem[] = [
          {
            id: 'profile',
            label: 'Complete seu perfil',
            description: 'Adicione seu nome e foto',
            tooltip: 'Personaliza a experiência e identifica o responsável pelo blog.',
            icon: <User className="h-4 w-4" />,
            completed: !!(profile?.full_name && profile?.avatar_url),
            path: '/app/profile'
          },
          {
            id: 'logo',
            label: 'Adicione o logo do blog',
            description: 'Personalize a identidade visual',
            tooltip: 'Melhora credibilidade e reconhecimento da marca.',
            icon: <Image className="h-4 w-4" />,
            completed: !!blog?.logo_url,
            path: '/app/my-blog'
          },
          {
            id: 'colors',
            label: 'Defina as cores',
            description: 'Configure a paleta do seu blog',
            tooltip: 'Garante identidade visual consistente e aumenta confiança.',
            icon: <Palette className="h-4 w-4" />,
            completed: !!blog?.primary_color && blog.primary_color !== '#F97316',
            path: '/app/my-blog'
          },
          {
            id: 'strategy',
            label: 'Configure sua Estratégia',
            description: 'Defina sua estratégia de conteúdo',
            tooltip: 'A estratégia orienta a IA para gerar conteúdo personalizado e de alta qualidade. Único passo obrigatório.',
            icon: <Sparkles className="h-4 w-4" />,
            completed: !!(strategy?.id && strategy?.empresa_nome),
            path: '/app/strategy'
          },
          {
            id: 'article',
            label: 'Publique seu primeiro artigo',
            description: 'Crie conteúdo para seu público',
            tooltip: 'Ativa o ciclo de dados e performance: SEO, leitura e conversão.',
            icon: <FileText className="h-4 w-4" />,
            completed: hasPublishedArticle,
            path: '/app/articles/new'
          },
          {
            id: 'cta',
            label: 'Configure o CTA',
            description: 'Adicione uma chamada para ação',
            tooltip: 'Transforma tráfego em lead/venda; impacta diretamente receita.',
            icon: <MousePointer className="h-4 w-4" />,
            completed: !!blog?.cta_text,
            path: '/app/my-blog'
          }
        ];

        setItems(checklistItems);

        // Hide if all items complete AND blog is older than 7 days
        const allComplete = checklistItems.every(item => item.completed);
        if (allComplete && daysSinceCreation > 7) {
          setShouldHide(true);
        }

      } catch (error) {
        console.error('Error checking setup status:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSetupStatus();
  }, [blogId, userId]);

  if (loading || shouldHide) {
    return null;
  }

  const completedCount = items.filter(item => item.completed).length;
  const progress = (completedCount / items.length) * 100;

  if (progress === 100) {
    return null;
  }

  return (
    <TooltipProvider>
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              🚀 Configure seu blog
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8 p-0"
            >
              {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <Progress value={progress} className="flex-1 h-2" />
            <span className="text-sm text-muted-foreground font-medium">
              {completedCount}/{items.length}
            </span>
          </div>
        </CardHeader>

        {!collapsed && (
          <CardContent className="pt-2">
            <div className="grid gap-2 md:grid-cols-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <button
                    onClick={() => !item.completed && navigate(item.path)}
                    disabled={item.completed}
                    className={cn(
                      "flex-1 flex items-center gap-3 p-2.5 rounded-lg transition-colors text-left min-h-[56px]",
                      item.completed
                        ? "bg-muted/50 cursor-default"
                        : "hover:bg-muted cursor-pointer"
                    )}
                  >
                    <div
                      className={cn(
                        "flex items-center justify-center h-7 w-7 rounded-full flex-shrink-0",
                        item.completed
                          ? "bg-green-500/20 text-green-600"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {item.completed ? <Check className="h-3.5 w-3.5" /> : item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "font-medium text-sm leading-tight",
                        item.completed && "line-through text-muted-foreground"
                      )}>
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </p>
                    </div>
                    {item.completed && (
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    )}
                  </button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className="p-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs">
                      <p>{item.tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </TooltipProvider>
  );
}
