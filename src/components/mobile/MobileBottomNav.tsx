import { useNavigate, useLocation } from 'react-router-dom';
import {
  Compass,
  FileText,
  LayoutTemplate,
  Globe,
  Users,
  LayoutDashboard,
  Zap,
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

const MVP_NAV_ITEMS: NavItem[] = [
  { path: '/client/radar', icon: Compass, label: 'Radar' },
  { path: '/client/articles', icon: FileText, label: 'Artigos' },
  { path: '/client/landing-pages', icon: LayoutTemplate, label: 'Páginas' },
  { path: '/client/portal', icon: Globe, label: 'Portal' },
  { path: '/client/leads', icon: Users, label: 'Leads' },
];

const ADVANCED_NAV_ITEMS: NavItem[] = [
  { path: '/client/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/client/radar', icon: Compass, label: 'Radar' },
  { path: '/client/articles', icon: FileText, label: 'Artigos' },
  { path: '/client/automation', icon: Zap, label: 'Máquina' },
  { path: '/client/account', icon: User, label: 'Conta' },
];

export function MobileBottomNav({ showAdvanced }: MobileBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = showAdvanced ? ADVANCED_NAV_ITEMS : MVP_NAV_ITEMS;

  const isActive = (path: string) => {
    // Special handling for radar - include /client/strategy paths
    if (path === '/client/radar') {
      return location.pathname === '/client/radar' || location.pathname.startsWith('/client/strategy');
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
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