import { useCallback, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Pencil, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { SidebarHeader } from './SidebarHeader';
import { NavItem } from './NavItem';
import { HubMenuItem } from './HubMenuItem';
import { ContentHubPanel } from './ContentHubPanel';
import { AccountFooter } from './AccountFooter';
import { MobileDrawer } from './MobileDrawer';

interface PremiumSidebarProps {
  isPlatformAdmin?: boolean;
  onHelpClick?: () => void;
}

/**
 * Premium Sidebar - Colapsável com expansão por hover
 *
 * Recolhido: mostra apenas ícones (64px)
 * Hover: expande suavemente para 280px mostrando labels
 */
export function PremiumSidebar({ isPlatformAdmin, onHelpClick }: PremiumSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Determinar hub/item ativo baseado na rota
  const getActiveHub = useCallback(() => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'dashboard';
    if (
      path.includes('/articles') ||
      path.includes('/radar') ||
      path.includes('/portal') ||
      path.includes('/landing-pages')
    )
      return 'content';
    if (path.includes('/leads')) return 'conversions';
    return 'dashboard';
  }, [location.pathname]);

  const [activeHub, setActiveHub] = useState(getActiveHub);

  useEffect(() => {
    setActiveHub(getActiveHub());
  }, [getActiveHub]);

  const handleNavigate = useCallback(
    (path: string) => {
      setMobileOpen(false);
      navigate(path);
    },
    [navigate]
  );

  const handleLogout = useCallback(async () => {
    await signOut();
    navigate('/');
  }, [signOut, navigate]);

  return (
    <>
      {/* ========== SIDEBAR DESKTOP ========== */}
      <aside
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
        className={cn(
          'hidden lg:flex fixed left-0 top-0 h-screen z-40',
          'flex-col bg-white dark:bg-gray-900',
          'border-r border-[#E5E7EB] dark:border-gray-700',
          'transition-all duration-300 overflow-hidden',
          isExpanded ? 'w-60 shadow-lg' : 'w-16'
        )}
        role="navigation"
        aria-label="Sidebar principal"
      >
        <SidebarHeader isExpanded={isExpanded} />

        <nav className="flex-1 py-4 overflow-y-auto scrollbar-custom">
          <NavItem
            id="dashboard"
            icon={Home}
            label="Dashboard"
            isActive={activeHub === 'dashboard'}
            isExpanded={isExpanded}
            onClick={() => handleNavigate('/client/dashboard')}
          />

          <HubMenuItem
            id="content"
            icon={Pencil}
            label="Conteúdo"
            isActive={activeHub === 'content'}
            isExpanded={isExpanded}
          >
            <ContentHubPanel
              onNavigate={handleNavigate}
              currentPath={location.pathname}
            />
          </HubMenuItem>

          <NavItem
            id="conversions"
            icon={MessageSquare}
            label="Conversões"
            isActive={activeHub === 'conversions'}
            isExpanded={isExpanded}
            onClick={() => handleNavigate('/client/leads')}
          />
        </nav>

        <AccountFooter
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          currentPath={location.pathname}
          isExpanded={isExpanded}
        />
      </aside>

      {/* ========== MOBILE ========== */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        currentPath={location.pathname}
      />
    </>
  );
}
