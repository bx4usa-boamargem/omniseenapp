import { cn } from '@/lib/utils';

export interface PanelItem {
  id: string;
  icon: React.ElementType;
  iconColor: string;
  iconTextColor: string;
  title: string;
  subtitle: string;
  path: string;
  badge?: string;
  comingSoon?: boolean;
}

interface SidebarHoverPanelProps {
  items: PanelItem[];
  onNavigate: (path: string) => void;
}

export function SidebarHoverPanel({ items, onNavigate }: SidebarHoverPanelProps) {
  return (
    <div className="w-72 bg-background border border-border/50 rounded-xl shadow-xl p-3 animate-in fade-in-0 slide-in-from-left-2 duration-200">
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          
          return (
            <button
              key={item.id}
              onClick={() => !item.comingSoon && onNavigate(item.path)}
              disabled={item.comingSoon}
              className={cn(
                "w-full flex items-start gap-3 px-3 py-3 rounded-lg transition-colors duration-150",
                item.comingSoon 
                  ? "opacity-60 cursor-not-allowed" 
                  : "hover:bg-muted/50 cursor-pointer"
              )}
            >
              {/* Colored Icon */}
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                item.iconColor
              )}>
                <Icon className={cn("h-5 w-5", item.iconTextColor)} />
              </div>
              
              {/* Text Content */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {item.title}
                  </span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-medium rounded">
                      {item.badge}
                    </span>
                  )}
                  {item.comingSoon && !item.badge && (
                    <span className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] font-medium rounded">
                      Em breve
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {item.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
