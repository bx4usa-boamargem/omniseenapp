import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { User, Palette, FileText, Image, Target, MousePointer } from 'lucide-react';

interface SetupBadge {
  id: string;
  name: string;
  icon: React.ReactNode;
  checklistItemId: string;
}

const SETUP_BADGES: SetupBadge[] = [
  { id: 'profile_ready', name: 'Perfil', icon: <User className="h-4 w-4" />, checklistItemId: 'profile' },
  { id: 'brand_colors', name: 'Cores', icon: <Palette className="h-4 w-4" />, checklistItemId: 'colors' },
  { id: 'first_article', name: 'Artigo', icon: <FileText className="h-4 w-4" />, checklistItemId: 'article' },
  { id: 'logo_added', name: 'Logo', icon: <Image className="h-4 w-4" />, checklistItemId: 'logo' },
  { id: 'strategy_set', name: 'Estratégia', icon: <Target className="h-4 w-4" />, checklistItemId: 'strategy' },
  { id: 'cta_configured', name: 'CTA', icon: <MousePointer className="h-4 w-4" />, checklistItemId: 'cta' },
];

interface SetupBadgesProps {
  completedItems: string[];
}

export function SetupBadges({ completedItems }: SetupBadgesProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground mr-1">Conquistas:</span>
        {SETUP_BADGES.map((badge, index) => {
          const unlocked = completedItems.includes(badge.checklistItemId);
          
          return (
            <Tooltip key={badge.id}>
              <TooltipTrigger asChild>
                <div 
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
                    unlocked 
                      ? "bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-md animate-badge-unlock" 
                      : "bg-muted text-muted-foreground opacity-40 grayscale"
                  )}
                  style={unlocked ? { animationDelay: `${index * 0.1}s` } : undefined}
                >
                  {badge.icon}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-sm">
                  {unlocked ? `✓ ${badge.name}` : `🔒 ${badge.name}`}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
