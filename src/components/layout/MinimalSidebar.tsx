import { useNavigate, useLocation } from 'react-router-dom';
import { Hammer, FileText, Users, Bell, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OmniseenLogo } from '@/components/ui/OmniseenLogo';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface MinimalNavItem {
  id: string;
  icon: React.ElementType;
  label: string;
  path: string;
  disabled?: boolean;
  tooltip?: string;
  action?: () => void;
}

interface MinimalSidebarProps {
  onHelpClick: () => void;
}

export function MinimalSidebar({ onHelpClick }: MinimalSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems: MinimalNavItem[] = [
    {
      id: 'builder',
      icon: Hammer,
      label: 'Construtor',
      path: '/client/dashboard',
      tooltip: 'Voltar ao Painel',
    },
    {
      id: 'documents',
      icon: FileText,
      label: 'Documentos',
      path: '/client/articles',
      tooltip: 'Artigos e Páginas',
    },
    {
      id: 'leads',
      icon: Users,
      label: 'Leads',
      path: '/client/leads',
      tooltip: 'Leads Capturados',
    },
    {
      id: 'notifications',
      icon: Bell,
      label: 'Notificações',
      path: '/client/notifications',
      disabled: true,
      tooltip: 'Em breve',
    },
    {
      id: 'help',
      icon: HelpCircle,
      label: 'Ajuda',
      path: '#help',
      tooltip: 'Assistente IA',
      action: onHelpClick,
    },
  ];

  const isActive = (path: string) => {
    if (path === '/client/dashboard') {
      return location.pathname === '/client/dashboard';
    }
    if (path === '/client/articles') {
      return location.pathname.startsWith('/client/articles') || 
             location.pathname.startsWith('/client/landing-pages') ||
             location.pathname.startsWith('/client/create');
    }
    return location.pathname.startsWith(path);
  };

  const handleClick = (item: MinimalNavItem) => {
    if (item.disabled) return;
    if (item.action) {
      item.action();
      return;
    }
    navigate(item.path);
  };

  return (
    <div className="flex flex-col items-center h-full py-4">
      {/* Logo */}
      <button
        onClick={() => navigate('/client/dashboard')}
        className="mb-8 p-2 rounded-xl hover:bg-primary/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
        aria-label="Ir para Dashboard"
      >
        <OmniseenLogo size="sm" />
      </button>

      {/* Navigation Icons */}
      <nav className="flex flex-col items-center gap-2 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Tooltip key={item.id} delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleClick(item)}
                  disabled={item.disabled}
                  className={cn(
                    'minimal-nav-item w-12 h-12 rounded-xl flex items-center justify-center',
                    'transition-all duration-200 cursor-pointer',
                    'text-muted-foreground hover:text-primary hover:bg-primary/10',
                    active && 'text-primary bg-primary/15 shadow-[0_0_12px_hsla(277,76%,50%,0.2)]',
                    item.disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground'
                  )}
                  aria-label={item.label}
                >
                  <Icon className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">
                {item.tooltip || item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </div>
  );
}
