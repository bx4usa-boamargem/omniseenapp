import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Sparkles,
  FileText,
  BarChart3,
  Globe,
  MessageSquare,
  CreditCard,
  Link2,
  Settings,
  HelpCircle,
  Sun,
  Star,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarHeader } from './SidebarHeader';
import { NavSection, NavItemConfig } from './NavSection';
import { SidebarFooter } from './SidebarFooter';
import { UserMenu } from './UserMenu';
import { MobileDrawer, MobileMenuButton } from './MobileDrawer';

interface PremiumSidebarProps {
  isPlatformAdmin?: boolean;
  onHelpClick?: () => void;
}

/**
 * Premium Sidebar SaaS - Estilo SEOWriting.ai
 * - Largura fixa: 280px (sempre visível)
 * - Duas seções: PRINCIPAL e CONFIGURAÇÕES
 * - Sem hover/colapsar/PIN
 */
export function PremiumSidebar({ isPlatformAdmin, onHelpClick }: PremiumSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Estados simplificados (sem expanded/pinned)
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Determinar item ativo baseado na rota atual
  const getActiveItem = useCallback(() => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'dashboard';
    if (path.includes('/articles/new')) return 'generate';
    if (path.includes('/articles')) return 'articles';
    if (path.includes('/analytics')) return 'analytics';
    if (path.includes('/portal')) return 'publish';
    if (path.includes('/leads')) return 'leads';
    if (path.includes('/settings')) return 'settings';
    if (path.includes('/integrations')) return 'integrations';
    if (path.includes('/help')) return 'help';
    return 'dashboard';
  }, [location.pathname]);

  const [activeItem, setActiveItem] = useState(getActiveItem);

  // Atualizar item ativo quando a rota mudar
  useEffect(() => {
    setActiveItem(getActiveItem());
  }, [getActiveItem]);

  // Handler de navegação
  const handleNavigation = (id: string, path?: string) => {
    setActiveItem(id);
    
    // Fechar menu mobile ao navegar
    setMobileOpen(false);
    
    // Handler especial para ajuda
    if (id === 'help' && onHelpClick) {
      onHelpClick();
      return;
    }
    
    if (path) {
      navigate(path);
    }
  };

  // Itens da seção PRINCIPAL
  const mainItems: NavItemConfig[] = [
    {
      id: 'dashboard',
      icon: Home,
      label: 'Dashboard',
      path: '/client/dashboard',
    },
    {
      id: 'generate',
      icon: Sparkles,
      label: 'Gerar Artigo',
      path: '/client/articles/new',
      highlight: true,
    },
    {
      id: 'articles',
      icon: FileText,
      label: 'Meus Artigos',
      path: '/client/articles',
      badge: 15,
      badgeType: 'default',
    },
    {
      id: 'analytics',
      icon: BarChart3,
      label: 'Analytics',
      path: '/client/analytics',
    },
    {
      id: 'publish',
      icon: Globe,
      label: 'Publicar',
      path: '/client/portal',
      badge: 3,
      badgeType: 'success',
      pulseDot: true,
    },
    {
      id: 'leads',
      icon: MessageSquare,
      label: 'Conversões',
      path: '/client/leads',
    },
  ];

  // Itens da seção CONFIGURAÇÕES
  const settingsItems: NavItemConfig[] = [
    {
      id: 'billing',
      icon: CreditCard,
      label: 'Plano & Cobrança',
      path: '/client/settings?tab=billing',
      badge: 'Growth',
      badgeType: 'purple',
      badgeIcon: Star,
    },
    {
      id: 'integrations',
      icon: Link2,
      label: 'Integrações',
      path: '/client/integrations',
      badge: 3,
      badgeType: 'default',
    },
    {
      id: 'settings',
      icon: Settings,
      label: 'Configurações',
      path: '/client/settings',
    },
    {
      id: 'help',
      icon: HelpCircle,
      label: 'Ajuda & Suporte',
      path: '/help',
    },
    {
      id: 'theme',
      icon: Sun,
      label: 'Tema',
      isThemeToggle: true,
    },
  ];

  // Adicionar item Admin se for platform admin
  if (isPlatformAdmin) {
    settingsItems.push({
      id: 'admin',
      icon: Shield,
      label: 'Admin Panel',
      path: '/admin',
    });
  }

  return (
    <>
      {/* Sidebar Desktop - Sempre 280px visível */}
      <aside
        className={cn(
          'hidden lg:flex fixed left-0 top-0 h-screen z-40',
          'w-[280px] flex-col bg-white dark:bg-gray-900',
          'border-r border-[#E5E7EB] dark:border-gray-700'
        )}
        role="navigation"
        aria-label="Sidebar principal"
      >
        {/* Header com Logo */}
        <SidebarHeader />

        {/* SEÇÃO PRINCIPAL - Scroll se necessário */}
        <div className="flex-1 overflow-y-auto scrollbar-custom">
          <NavSection
            title="PRINCIPAL"
            items={mainItems}
            activeItem={activeItem}
            onItemClick={handleNavigation}
          />
        </div>

        {/* Divisor Visual Simples */}
        <div className="mx-4 my-4">
          <div className="h-px w-full bg-[#E5E7EB] dark:bg-gray-700" />
        </div>

        {/* SEÇÃO CONFIGURAÇÕES - Fundo diferente */}
        <div className="bg-[#FAFAFA] dark:bg-gray-800/50">
          <NavSection
            title="CONFIGURAÇÕES"
            items={settingsItems}
            onItemClick={handleNavigation}
            isSecondary
          />
        </div>

        {/* Footer - Área do Usuário */}
        <SidebarFooter onMenuToggle={() => setMenuOpen(!menuOpen)} />
      </aside>

      {/* Menu Flutuante do Usuário */}
      {menuOpen && (
        <UserMenu onClose={() => setMenuOpen(false)} />
      )}

      {/* Mobile: Botão Hamburguer */}
      <MobileMenuButton onClick={() => setMobileOpen(true)} />

      {/* Mobile: Drawer */}
      <MobileDrawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        mainItems={mainItems}
        settingsItems={settingsItems}
        activeItem={activeItem}
        onItemClick={handleNavigation}
        onMenuToggle={() => setMenuOpen(!menuOpen)}
      />
    </>
  );
}
