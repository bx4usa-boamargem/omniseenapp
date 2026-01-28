import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Radar, 
  FileText, 
  LayoutTemplate, 
  Globe, 
  Users, 
  Settings,
  HelpCircle,
  User,
  Building2,
  Compass,
  CreditCard
} from 'lucide-react';
import { OmniseenLogo } from '@/components/ui/OmniseenLogo';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarHoverPanel, PanelItem } from './SidebarHoverPanel';
import { cn } from '@/lib/utils';

interface MinimalSidebarProps {
  onHelpClick: () => void;
}

export function MinimalSidebar({ onHelpClick }: MinimalSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Account panel items for hover menu
  const accountPanelItems: PanelItem[] = [
    {
      id: 'my-account',
      icon: User,
      iconColor: 'bg-blue-100 dark:bg-blue-900/30',
      iconTextColor: 'text-blue-600 dark:text-blue-400',
      title: 'Minha Conta',
      subtitle: 'Gerencie seu perfil e preferências.',
      path: '/client/account',
    },
    {
      id: 'my-company',
      icon: Building2,
      iconColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconTextColor: 'text-emerald-600 dark:text-emerald-400',
      title: 'Minha Empresa',
      subtitle: 'Configure informações do negócio.',
      path: '/client/company',
    },
    {
      id: 'strategy',
      icon: Compass,
      iconColor: 'bg-purple-100 dark:bg-purple-900/30',
      iconTextColor: 'text-purple-600 dark:text-purple-400',
      title: 'Estratégia',
      subtitle: 'Defina sua estratégia de conteúdo.',
      path: '/client/radar',
    },
    {
      id: 'billing',
      icon: CreditCard,
      iconColor: 'bg-amber-100 dark:bg-amber-900/30',
      iconTextColor: 'text-amber-600 dark:text-amber-400',
      title: 'Plano & Cobrança',
      subtitle: 'Gerencie sua assinatura e faturas.',
      path: '/client/settings?tab=billing',
    },
  ];

  const isActive = (path: string) => {
    if (path.includes('?')) {
      return location.pathname + location.search === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex flex-col items-center h-full py-4">
      {/* Logo - Brand Anchor */}
      <button
        onClick={() => navigate('/client/dashboard')}
        className="min-h-[48px] flex items-center justify-center mb-4 px-2 py-2 rounded-xl hover:bg-orange-500/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
        aria-label="Ir para Dashboard"
      >
        <OmniseenLogo size="sidebar" />
      </button>

      {/* Navigation Sections */}
      <nav className="flex flex-col items-center gap-1 flex-1 w-full px-2">
        {/* OPORTUNIDADES */}
        <div className="w-full mb-2">
          <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2">
            Oportunidades
          </span>
          <div className="mt-1 flex flex-col items-center">
            <SidebarNavItem
              icon={Radar}
              label="Radar"
              isActive={isActive('/client/radar')}
              onClick={() => navigate('/client/radar')}
            />
          </div>
        </div>

        {/* CRIAR */}
        <div className="w-full mb-2">
          <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2">
            Criar
          </span>
          <div className="mt-1 flex flex-col items-center gap-1">
            <SidebarNavItem
              icon={FileText}
              label="Artigos"
              isActive={isActive('/client/articles')}
              onClick={() => navigate('/client/articles')}
            />
            <SidebarNavItem
              icon={LayoutTemplate}
              label="Páginas SEO"
              isActive={isActive('/client/landing-pages')}
              onClick={() => navigate('/client/landing-pages')}
            />
          </div>
        </div>

        {/* PÚBLICO */}
        <div className="w-full mb-2">
          <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2">
            Público
          </span>
          <div className="mt-1 flex flex-col items-center">
            <SidebarNavItem
              icon={Globe}
              label="Portal"
              isActive={isActive('/client/portal')}
              onClick={() => navigate('/client/portal')}
            />
          </div>
        </div>

        {/* CONVERSÕES */}
        <div className="w-full mb-2">
          <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2">
            Conversões
          </span>
          <div className="mt-1 flex flex-col items-center">
            <SidebarNavItem
              icon={Users}
              label="Leads"
              isActive={isActive('/client/leads')}
              onClick={() => navigate('/client/leads')}
            />
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* CONTA */}
        <div className="w-full">
          <span className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2">
            Conta
          </span>
          <div className="mt-1 flex flex-col items-center gap-1">
            <SidebarNavItem
              icon={Settings}
              label="Conta"
              isActive={isActive('/client/account') || isActive('/client/company') || isActive('/client/settings')}
              onClick={() => navigate('/client/account')}
              panel={<SidebarHoverPanel items={accountPanelItems} onNavigate={navigate} />}
            />
            <SidebarNavItem
              icon={HelpCircle}
              label="Ajuda"
              isActive={false}
              onClick={onHelpClick}
            />
          </div>
        </div>
      </nav>
    </div>
  );
}
