import { useCallback, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  FileText,
  BarChart3,
  MessageSquare,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { SidebarHeader } from './SidebarHeader';
import { NavItem } from './NavItem';
import { HubMenuItem } from './HubMenuItem';
import { ContentHubPanel } from './ContentHubPanel';
import { AccountHubPanel } from './AccountHubPanel';
import { SidebarFooter } from './SidebarFooter';
import { MobileDrawer, MobileMenuButton } from './MobileDrawer';
import { UserMenu } from './UserMenu';

interface PremiumSidebarProps {
  isPlatformAdmin?: boolean;
  onHelpClick?: () => void;
}

/**
 * Premium Sidebar - Design Limpo com Hubs Flutuantes
 * 
 * Estrutura:
 * - Logo OmniSeen oficial no topo
 * - 5 itens principais (Dashboard, Conteúdo HUB, Analytics, Conversões, Conta HUB)
 * - Hubs abrem menus flutuantes ao hover/click
 * - Footer com seletor de workspace
 */
export function PremiumSidebar({ isPlatformAdmin, onHelpClick }: PremiumSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  
  const [menuOpen, setMenuOpen] = useState(false);
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
    ) return 'content';
    
    // Analytics
    if (path.includes('/analytics')) return 'analytics';
    
    // Conversões
    if (path.includes('/leads')) return 'conversions';
    
    // Hub: Conta & Sistema
    if (
      path.includes('/account') || 
      path.includes('/company') || 
      path.includes('/settings') || 
      path.includes('/help')
    ) return 'account';
    
    return 'dashboard';
  }, [location.pathname]);

  const [activeHub, setActiveHub] = useState(getActiveHub);

  useEffect(() => {
    setActiveHub(getActiveHub());
  }, [getActiveHub]);

  // Handler de navegação
  const handleNavigate = useCallback((path: string) => {
    setMobileOpen(false);
    navigate(path);
  }, [navigate]);

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

        {/* Navegação Principal */}
        <nav className="flex-1 py-4 overflow-y-auto scrollbar-custom">
          {/* Dashboard - Link direto */}
          <NavItem 
            id="dashboard"
            icon={Home}
            label="Dashboard"
            isActive={activeHub === 'dashboard'}
            onClick={() => handleNavigate('/client/dashboard')}
          />

          {/* Conteúdo - HUB */}
          <HubMenuItem
            id="content"
            icon={FileText}
            label="Conteúdo"
            isActive={activeHub === 'content'}
          >
            <ContentHubPanel 
              onNavigate={handleNavigate} 
              currentPath={location.pathname}
            />
          </HubMenuItem>

          {/* Analytics - Link direto */}
          <NavItem 
            id="analytics"
            icon={BarChart3}
            label="Analytics"
            isActive={activeHub === 'analytics'}
            onClick={() => handleNavigate('/client/analytics')}
          />

          {/* Conversões - Link direto */}
          <NavItem 
            id="conversions"
            icon={MessageSquare}
            label="Conversões"
            isActive={activeHub === 'conversions'}
            onClick={() => handleNavigate('/client/leads')}
          />

          {/* Separador */}
          <div className="mx-4 my-4 h-px bg-[#E5E7EB] dark:bg-gray-700" />

          {/* Conta & Sistema - HUB */}
          <HubMenuItem
            id="account"
            icon={Settings}
            label="Conta & Sistema"
            isActive={activeHub === 'account'}
          >
            <AccountHubPanel 
              onNavigate={handleNavigate}
              onLogout={handleLogout}
              currentPath={location.pathname}
            />
          </HubMenuItem>
        </nav>

        {/* Footer - Seletor de Workspace */}
        <SidebarFooter onMenuToggle={() => setMenuOpen(!menuOpen)} />
      </aside>

      {/* Menu Flutuante do Usuário (footer click) */}
      {menuOpen && (
        <UserMenu onClose={() => setMenuOpen(false)} />
      )}

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
