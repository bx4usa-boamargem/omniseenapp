import { useNavigate, useLocation } from 'react-router-dom';
import {
  PenTool,
  FileText,
  Users,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
}

interface MobileBottomNavProps {
  /** quando true, mostra navegação completa (conta interna/admin) */
  showAdvanced?: boolean;
}

// Navegação simplificada para mobile - segue o mesmo modelo do sidebar minimalista
const MOBILE_NAV_ITEMS: NavItem[] = [
  { path: '/client/dashboard', icon: PenTool, label: 'Criar' },
  { path: '/client/articles', icon: FileText, label: 'Docs' },
  { path: '/client/leads', icon: Users, label: 'Leads' },
  { path: '/client/settings', icon: User, label: 'Conta' },
];

export function MobileBottomNav({ showAdvanced }: MobileBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/client/dashboard') {
      return location.pathname === '/client/dashboard';
    }
    if (path === '/client/articles') {
      return location.pathname.startsWith('/client/articles') || 
             location.pathname.startsWith('/client/landing-pages') ||
             location.pathname.startsWith('/client/articles/engine') ||
             location.pathname.startsWith('/client/radar');
    }
    if (path === '/client/settings') {
      return location.pathname.startsWith('/client/settings') ||
             location.pathname.startsWith('/client/profile');
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full min-w-[64px] py-2 transition-colors touch-manipulation",
                active 
                  ? "text-primary" 
                  : "text-muted-foreground active:text-primary"
              )}
            >
              <Icon className={cn(
                "h-6 w-6 transition-transform",
                active && "scale-110"
              )} />
              <span className={cn(
                "text-[10px] font-medium",
                active && "font-semibold"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      {/* Safe area padding for iOS */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
