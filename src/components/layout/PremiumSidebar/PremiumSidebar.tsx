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
import { MobileDrawer, MobileMenuButton } from './MobileDrawer';

interface PremiumSidebarProps {
  isPlatformAdmin?: boolean;
  onHelpClick?: () => void;
}

/**
 * Premium Sidebar - Design Limpo com Hubs Flutuantes
 *
 * Estrutura simplificada:
 * - Logo OmniSeen oficial no topo
 * - 3 itens principais (Dashboard, Conteúdo HUB, Conversões)
 * - Footer com AccountFooter (HUB da conta)
 */
export function PremiumSidebar({ isPlatformAdmin, onHelpClick }: PremiumSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const [mobileOpen, setMobileOpen] = useState(false);

  // Determinar hub/item ativo baseado na rota
  const getActiveHub = useCallback(() => {
    const path = location.pathname;

    // Dashboard
    if (path.includes('/dashboard')) return 'dashboard';

    // Hub: Conteúdo (agrupa várias rotas)
    if (
      path.includes('/articles') ||
      path.includes('/radar') ||
      path.includes('/portal') ||
      path.includes('/landing-pages')
    )
      return 'content';

    // Conversões
    if (path.includes('/leads')) return 'conversions';

    // Rotas de conta são tratadas no footer, não marcam item ativo no corpo
    return 'dashboard';
  }, [location.pathname]);

  const [activeHub, setActiveHub] = useState(getActiveHub);

  useEffect(() => {
    setActiveHub(getActiveHub());
  }, [getActiveHub]);

  // Handler de navegação
  const handleNavigate = useCallback(
    (path: string) => {
      setMobileOpen(false);
      navigate(path);
    },
    [navigate]
  );

  // Handler de logout
  const handleLogout = useCallback(async () => {
    await signOut();
    navigate('/');
  }, [signOut, navigate]);

  return (
    <>
      {/* ========== SIDEBAR DESKTOP ========== */}
      <aside
        className={cn(
          'hidden lg:flex fixed left-0 top-0 h-screen z-40',
          'w-[280px] flex-col bg-white dark:bg-gray-900',
          'border-r border-[#E5E7EB] dark:border-gray-700'
        )}
        role="navigation"
        aria-label="Sidebar principal"
      >
        {/* Header com Logo Oficial */}
        <SidebarHeader />

        {/* Navegação Principal - Apenas 3 itens */}
        <nav className="flex-1 py-4 overflow-y-auto scrollbar-custom">
          {/* Dashboard - Link direto */}
          <NavItem
            id="dashboard"
            icon={Home}
            label="Dashboard"
            isActive={activeHub === 'dashboard'}
            onClick={() => handleNavigate('/client/dashboard')}
          />

          {/* Conteúdo - HUB com ícone de lápis */}
          <HubMenuItem
            id="content"
            icon={Pencil}
            label="Conteúdo"
            isActive={activeHub === 'content'}
          >
            <ContentHubPanel
              onNavigate={handleNavigate}
              currentPath={location.pathname}
            />
          </HubMenuItem>

          {/* Conversões - Link direto */}
          <NavItem
            id="conversions"
            icon={MessageSquare}
            label="Conversões"
            isActive={activeHub === 'conversions'}
            onClick={() => handleNavigate('/client/leads')}
          />
        </nav>

        {/* Footer - HUB da Conta (abre para cima) */}
        <AccountFooter
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          currentPath={location.pathname}
        />
      </aside>

      {/* ========== MOBILE ========== */}
      <MobileMenuButton onClick={() => setMobileOpen(true)} />

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
