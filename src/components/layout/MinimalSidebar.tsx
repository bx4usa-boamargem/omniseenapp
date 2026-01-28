import { useNavigate, useLocation } from 'react-router-dom';
import { 
  PenTool, 
  FileText, 
  Users, 
  Bell, 
  HelpCircle,
  Layers,
  LayoutTemplate,
  Sparkles,
  Radar
} from 'lucide-react';
import { OmniseenLogo } from '@/components/ui/OmniseenLogo';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarHoverPanel, PanelItem } from './SidebarHoverPanel';

interface MinimalSidebarProps {
  onHelpClick: () => void;
}

export function MinimalSidebar({ onHelpClick }: MinimalSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Creation tools panel items
  const creationTools: PanelItem[] = [
    {
      id: 'one-click',
      icon: FileText,
      iconColor: 'bg-amber-100 dark:bg-amber-900/30',
      iconTextColor: 'text-amber-600 dark:text-amber-400',
      title: 'Postagem de Blog com um clique',
      subtitle: 'Crie e publique um artigo usando apenas um título.',
      path: '/client/create',
    },
    {
      id: 'bulk',
      icon: Layers,
      iconColor: 'bg-orange-100 dark:bg-orange-900/30',
      iconTextColor: 'text-orange-600 dark:text-orange-400',
      title: 'Geração de artigos em massa',
      subtitle: 'Gere e publique até 100 artigos automaticamente.',
      path: '/client/bulk-create',
      comingSoon: true,
    },
    {
      id: 'super-page',
      icon: LayoutTemplate,
      iconColor: 'bg-green-100 dark:bg-green-900/30',
      iconTextColor: 'text-green-600 dark:text-green-400',
      title: 'Super Página',
      subtitle: 'Crie páginas CTA completas com base na SERP.',
      path: '/client/landing-pages/new',
    },
    {
      id: 'rewrite',
      icon: Sparkles,
      iconColor: 'bg-purple-100 dark:bg-purple-900/30',
      iconTextColor: 'text-purple-600 dark:text-purple-400',
      title: 'Ferramenta de reescrita',
      subtitle: 'Reescreva com insights da SERP para ranquear.',
      path: '/client/rewrite',
      badge: 'Novo!',
      comingSoon: true,
    },
  ];

  // Documents panel items
  const documentItems: PanelItem[] = [
    {
      id: 'articles',
      icon: FileText,
      iconColor: 'bg-blue-100 dark:bg-blue-900/30',
      iconTextColor: 'text-blue-600 dark:text-blue-400',
      title: 'Meus Artigos',
      subtitle: 'Visualize e gerencie todos os seus artigos.',
      path: '/client/articles',
    },
    {
      id: 'landing-pages',
      icon: LayoutTemplate,
      iconColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconTextColor: 'text-emerald-600 dark:text-emerald-400',
      title: 'Minhas Páginas',
      subtitle: 'Gerencie suas Super Páginas.',
      path: '/client/landing-pages',
    },
  ];

  const isCreationActive = () => {
    return location.pathname.startsWith('/client/create') ||
           location.pathname.startsWith('/client/bulk-create') ||
           location.pathname.startsWith('/client/rewrite');
  };

  const isDocumentsActive = () => {
    return location.pathname.startsWith('/client/articles') || 
           location.pathname.startsWith('/client/landing-pages');
  };

  const isLeadsActive = () => {
    return location.pathname.startsWith('/client/leads');
  };

  const isRadarActive = () => {
    return location.pathname.startsWith('/client/radar');
  };

  return (
    <div className="flex flex-col items-center h-full py-4">
      {/* Logo - Brand Anchor */}
      <button
        onClick={() => navigate('/client/dashboard')}
        className="min-h-[56px] flex items-center justify-center mb-6 px-2 py-3 rounded-xl hover:bg-primary/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
        aria-label="Ir para Dashboard"
      >
        <OmniseenLogo size="sidebar" />
      </button>

      {/* Navigation Icons */}
      <nav className="flex flex-col items-center gap-2 flex-1">
        {/* Creation - with hover panel */}
        <SidebarNavItem
          icon={PenTool}
          label="Criar"
          isActive={isCreationActive()}
          panel={<SidebarHoverPanel items={creationTools} onNavigate={navigate} />}
        />

        {/* Documents - with hover panel */}
        <SidebarNavItem
          icon={FileText}
          label="Documentos"
          isActive={isDocumentsActive()}
          panel={<SidebarHoverPanel items={documentItems} onNavigate={navigate} />}
        />

        {/* Leads - direct navigation */}
        <SidebarNavItem
          icon={Users}
          label="Leads"
          isActive={isLeadsActive()}
          onClick={() => navigate('/client/leads')}
        />

        {/* Radar - primary navigation */}
        <SidebarNavItem
          icon={Radar}
          label="Radar"
          isActive={isRadarActive()}
          onClick={() => navigate('/client/radar')}
        />

        {/* Notifications - disabled */}
        <SidebarNavItem
          icon={Bell}
          label="Notificações"
          isActive={false}
          disabled
        />

        {/* Help - action */}
        <SidebarNavItem
          icon={HelpCircle}
          label="Ajuda"
          isActive={false}
          onClick={onHelpClick}
        />
      </nav>
    </div>
  );
}
