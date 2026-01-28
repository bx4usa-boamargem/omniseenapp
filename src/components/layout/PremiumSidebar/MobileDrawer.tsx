import { useState } from 'react';
import { X, Menu, Home, Pencil, MessageSquare, User, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarHeader } from './SidebarHeader';
import { ContentHubPanel } from './ContentHubPanel';
import { AccountHubPanel } from './AccountHubPanel';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  currentPath?: string;
}

/**
 * Drawer mobile para navegação em telas < 1024px
 * - Largura 320px
 * - Overlay escuro ao abrir
 * - Estrutura simplificada: Dashboard, Conteúdo (accordion), Conversões, Minha Conta (accordion)
 */
export function MobileDrawer({
  open,
  onClose,
  onNavigate,
  onLogout,
  currentPath,
}: MobileDrawerProps) {
  const [contentExpanded, setContentExpanded] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);

  if (!open) return null;

  // Determinar item ativo
  const getActiveItem = () => {
    if (!currentPath) return 'dashboard';
    if (currentPath.includes('/dashboard')) return 'dashboard';
    if (
      currentPath.includes('/articles') ||
      currentPath.includes('/radar') ||
      currentPath.includes('/portal') ||
      currentPath.includes('/landing-pages')
    )
      return 'content';
    if (currentPath.includes('/leads')) return 'conversions';
    if (
      currentPath.includes('/account') ||
      currentPath.includes('/company') ||
      currentPath.includes('/settings') ||
      currentPath.includes('/help')
    )
      return 'account';
    return 'dashboard';
  };

  const activeItem = getActiveItem();

  const handleNavigate = (path: string) => {
    onNavigate(path);
    onClose();
  };

  const NavButton = ({
    icon: Icon,
    label,
    isActive,
    onClick,
    isHub,
    isExpanded,
  }: {
    icon: React.ElementType;
    label: string;
    isActive?: boolean;
    onClick: () => void;
    isHub?: boolean;
    isExpanded?: boolean;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 rounded-lg mx-2 relative',
        'transition-all duration-200',
        isActive && [
          'bg-[#EDE9FE] dark:bg-[#7C3AED]/20',
          'text-[#7C3AED] font-semibold',
        ],
        !isActive && [
          'text-[#6B7280] dark:text-gray-400',
          'hover:text-[#111827] dark:hover:text-white',
          'hover:bg-[#F9FAFB] dark:hover:bg-gray-800',
        ]
      )}
    >
      {isActive && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
          style={{ background: 'linear-gradient(to bottom, #7C3AED, #F97316)' }}
        />
      )}
      <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-[#7C3AED]')} />
      <span className="flex-1 text-left text-sm font-medium">{label}</span>
      {isHub &&
        (isExpanded ? (
          <ChevronUp className="h-4 w-4 text-[#9CA3AF]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#9CA3AF]" />
        ))}
    </button>
  );

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-[59] lg:hidden animate-in fade-in cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Content */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen w-[320px] bg-white dark:bg-gray-900 z-[60] lg:hidden',
          'animate-in slide-in-from-left duration-300',
          'flex flex-col'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
      >
        {/* Botão fechar */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-md hover:bg-[#F3F4F6] dark:hover:bg-gray-700 z-10"
          aria-label="Fechar menu"
        >
          <X className="h-6 w-6 text-[#6B7280]" />
        </button>

        {/* Header */}
        <SidebarHeader />

        {/* Navegação */}
        <div className="flex-1 overflow-y-auto scrollbar-custom py-4">
          {/* Dashboard */}
          <NavButton
            icon={Home}
            label="Dashboard"
            isActive={activeItem === 'dashboard'}
            onClick={() => handleNavigate('/client/dashboard')}
          />

          {/* Conteúdo - Accordion */}
          <NavButton
            icon={Pencil}
            label="Conteúdo"
            isActive={activeItem === 'content'}
            onClick={() => setContentExpanded(!contentExpanded)}
            isHub
            isExpanded={contentExpanded}
          />
          {contentExpanded && (
            <div className="ml-4 border-l-2 border-[#E5E7EB] dark:border-gray-700">
              <ContentHubPanel onNavigate={handleNavigate} currentPath={currentPath} />
            </div>
          )}

          {/* Conversões */}
          <NavButton
            icon={MessageSquare}
            label="Conversões"
            isActive={activeItem === 'conversions'}
            onClick={() => handleNavigate('/client/leads')}
          />

          {/* Separador */}
          <div className="mx-4 my-4 h-px bg-[#E5E7EB] dark:bg-gray-700" />

          {/* Minha Conta - Accordion */}
          <NavButton
            icon={User}
            label="Minha Conta"
            isActive={activeItem === 'account'}
            onClick={() => setAccountExpanded(!accountExpanded)}
            isHub
            isExpanded={accountExpanded}
          />
          {accountExpanded && (
            <div className="ml-4 border-l-2 border-[#E5E7EB] dark:border-gray-700">
              <AccountHubPanel
                onNavigate={handleNavigate}
                onLogout={onLogout}
                currentPath={currentPath}
              />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

/**
 * Botão hamburguer para abrir o drawer no mobile
 */
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed top-4 right-4 z-50 lg:hidden p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-shadow"
      aria-label="Abrir menu"
    >
      <Menu className="h-6 w-6 text-[#6B7280]" />
    </button>
  );
}
