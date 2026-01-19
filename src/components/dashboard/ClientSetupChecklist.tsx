import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useConfetti } from '@/hooks/useConfetti';
import { SetupBadges } from './SetupBadges';
import { 
  Rocket, 
  User, 
  Palette, 
  FileText, 
  Image, 
  Target, 
  MousePointer,
  Check,
  Circle,
  HelpCircle,
  Trophy
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface ClientSetupChecklistProps {
  blogId: string;
  userId: string;
  onComplete?: () => void;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  tooltip: string;
  icon: React.ReactNode;
  path: string;
  completed: boolean;
}

const TOOLTIPS = {
  profile: "Define quem é você para o motor da Omniseen. Ajuda a IA a gerar conteúdos alinhados à sua marca.",
  colors: "Cria a identidade visual do seu blog público. Impacta como sua marca é percebida.",
  article: "Ativa o motor de indexação. Sem isso, seu blog não começa a ser reconhecido.",
  logo: "Seu blog precisa parecer uma marca real para ganhar autoridade.",
  strategy: "Define nicho, foco e território. Guia toda a inteligência da plataforma.",
  cta: "Transforma visitas em leads. Sem isso, você tem tráfego sem resultado."
};

export function ClientSetupChecklist({ blogId, userId, onComplete }: ClientSetupChecklistProps) {
  const navigate = useNavigate();
  const { fireConfetti, fireStarConfetti } = useConfetti();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCelebration, setShowCelebration] = useState(false);
  const previousCompletedRef = useRef<Set<string>>(new Set());
  const hasTriggeredComplete = useRef(false);

  useEffect(() => {
    const fetchChecklistStatus = async () => {
      try {
        // Fetch all data in parallel
        const [profileRes, blogRes, articlesRes, strategyRes] = await Promise.all([
          supabase.from('profiles').select('full_name, avatar_url').eq('user_id', userId).maybeSingle(),
          supabase.from('blogs').select('primary_color, logo_url, cta_text').eq('id', blogId).maybeSingle(),
          supabase.from('articles').select('id').eq('blog_id', blogId).eq('status', 'published').limit(1),
          supabase.from('client_strategy').select('empresa_nome').eq('blog_id', blogId).maybeSingle()
        ]);

        const profile = profileRes.data;
        const blog = blogRes.data;
        const hasPublishedArticle = (articlesRes.data?.length ?? 0) > 0;
        const strategy = strategyRes.data;

        const checklistItems: ChecklistItem[] = [
          {
            id: 'profile',
            label: 'Complete seu perfil',
            description: 'Adicione seu nome e foto',
            tooltip: TOOLTIPS.profile,
            icon: <User className="h-4 w-4" />,
            path: '/client/account',
            completed: !!(profile?.full_name && profile?.avatar_url)
          },
          {
            id: 'colors',
            label: 'Defina as cores',
            description: 'Configure a paleta do seu blog',
            tooltip: TOOLTIPS.colors,
            icon: <Palette className="h-4 w-4" />,
            path: '/client/company',
            completed: !!(blog?.primary_color && blog.primary_color !== '#F97316')
          },
          {
            id: 'article',
            label: 'Publique seu primeiro artigo',
            description: 'Crie conteúdo inicial',
            tooltip: TOOLTIPS.article,
            icon: <FileText className="h-4 w-4" />,
            path: '/client/create',
            completed: hasPublishedArticle
          },
          {
            id: 'logo',
            label: 'Adicione o logo do blog',
            description: 'Personalize a identidade visual',
            tooltip: TOOLTIPS.logo,
            icon: <Image className="h-4 w-4" />,
            path: '/client/company',
            completed: !!blog?.logo_url
          },
          {
            id: 'strategy',
            label: 'Configure sua Estratégia',
            description: 'Defina nicho, território e foco',
            tooltip: TOOLTIPS.strategy,
            icon: <Target className="h-4 w-4" />,
            path: '/client/company',
            completed: !!strategy?.empresa_nome
          },
          {
            id: 'cta',
            label: 'Configure o CTA',
            description: 'Adicione a chamada para ação',
            tooltip: TOOLTIPS.cta,
            icon: <MousePointer className="h-4 w-4" />,
            path: '/client/company',
            completed: !!blog?.cta_text
          }
        ];

        // Detect newly completed items
        const newlyCompleted = checklistItems.filter(
          item => item.completed && !previousCompletedRef.current.has(item.id)
        );

        if (newlyCompleted.length > 0 && previousCompletedRef.current.size > 0) {
          // Trigger mini celebration for each newly completed item
          newlyCompleted.forEach(item => {
            fireStarConfetti(0.5, 0.3);
            toast.success(
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center animate-badge-unlock">
                  {item.icon}
                </div>
                <div>
                  <p className="font-semibold">Nova Conquista!</p>
                  <p className="text-sm text-muted-foreground">{item.label} ✓</p>
                </div>
              </div>,
              { duration: 4000 }
            );
          });
        }

        // Update previous completed set
        previousCompletedRef.current = new Set(checklistItems.filter(i => i.completed).map(i => i.id));

        setItems(checklistItems);
        setLoading(false);

        // Check if all items are complete
        const allComplete = checklistItems.every(item => item.completed);
        if (allComplete && !hasTriggeredComplete.current) {
          hasTriggeredComplete.current = true;
          // Big celebration!
          setShowCelebration(true);
          fireConfetti({ particleCount: 150 });
          
          // Trigger achievement check
          supabase.functions.invoke('check-achievements', {
            body: { userId, blogId }
          });

          // Hide checklist after celebration
          setTimeout(() => {
            setShowCelebration(false);
            onComplete?.();
          }, 4000);
        }
      } catch (error) {
        console.error('Error fetching checklist status:', error);
        setLoading(false);
      }
    };

    fetchChecklistStatus();
  }, [blogId, userId, fireConfetti, fireStarConfetti, onComplete]);

  if (loading) return null;

  const completed = items.filter(i => i.completed).length;
  const total = items.length;
  const progress = (completed / total) * 100;

  // Don't render if all complete (after celebration)
  if (completed === total && !showCelebration) return null;

  return (
    <>
      {/* Celebration Modal */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-card p-8 rounded-2xl text-center space-y-4 animate-in zoom-in duration-500 max-w-md mx-4 shadow-2xl border border-primary/20">
            <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center animate-pulse shadow-lg">
              <Trophy className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Configuração Completa! 🎉</h2>
            <p className="text-muted-foreground">
              Seu blog está 100% configurado e pronto para dominar território.
            </p>
            <div className="flex justify-center gap-2 mt-4">
              {items.map(item => (
                <div 
                  key={item.id} 
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white animate-badge-unlock shadow-md"
                  style={{ animationDelay: `${items.indexOf(item) * 0.1}s` }}
                >
                  {item.icon}
                </div>
              ))}
            </div>
            <Button 
              onClick={() => {
                setShowCelebration(false);
                onComplete?.();
              }}
              className="mt-4 client-btn-primary"
            >
              Começar a produzir
            </Button>
          </div>
        </div>
      )}

      {/* Checklist Card */}
      <Card className="client-card p-6">
        {/* Header with progress */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="font-semibold flex items-center gap-2 text-foreground">
            <Rocket className="h-5 w-5 text-primary" />
            Configure seu blog
          </h3>
          <div className="flex items-center gap-3">
            <Progress value={progress} className="w-32 h-2 animate-progress-fill" />
            <span className="text-sm font-medium text-muted-foreground">{completed}/{total}</span>
          </div>
        </div>

        {/* Setup Badges */}
        <div className="mb-4 pb-4 border-b border-border">
          <SetupBadges completedItems={items.filter(i => i.completed).map(i => i.id)} />
        </div>

        {/* Grid 2 columns */}
        <div className="grid md:grid-cols-2 gap-3">
          {items.map((item, index) => {
            const isRecentlyCompleted = item.completed && previousCompletedRef.current.has(item.id);
            
            return (
              <TooltipProvider key={item.id}>
                <div
                  className={cn(
                    "p-4 rounded-lg border transition-all duration-300 cursor-pointer group",
                    item.completed 
                      ? "bg-primary/5 border-primary/20" 
                      : "bg-muted/30 border-border hover:border-primary/50 hover:bg-muted/50",
                    isRecentlyCompleted && "animate-checklist-complete"
                  )}
                  style={{ animationDelay: `${index * 0.05}s` }}
                  onClick={() => !item.completed && navigate(item.path)}
                >
                  <div className="flex items-start gap-3">
                    {/* Status icon */}
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all",
                      item.completed 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted text-muted-foreground group-hover:bg-primary/20"
                    )}>
                      {item.completed ? (
                        <Check className={cn(
                          "h-4 w-4",
                          isRecentlyCompleted && "animate-checkmark-pop"
                        )} />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-medium text-sm",
                          item.completed ? "text-foreground" : "text-foreground group-hover:text-primary"
                        )}>
                          {item.label}
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button 
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <HelpCircle className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p className="text-sm">{item.tooltip}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                  </div>
                </div>
              </TooltipProvider>
            );
          })}
        </div>
      </Card>
    </>
  );
}
