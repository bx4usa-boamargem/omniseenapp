import { X, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarHeader } from './SidebarHeader';
import { NavSection, NavItemConfig } from './NavSection';
import { SidebarFooter } from './SidebarFooter';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  mainItems: NavItemConfig[];
  settingsItems: NavItemConfig[];
  activeItem: string;
  onItemClick: (id: string, path?: string) => void;
  onMenuToggle: () => void;
}

/**
 * Drawer mobile para navegação em telas < 1024px
 * - Largura 320px
 * - Overlay escuro ao abrir
 * - Animação slide-in da esquerda
 */
export function MobileDrawer({
  open,
  onClose,
  mainItems,
  settingsItems,
  activeItem,
  onItemClick,
  onMenuToggle,
}: MobileDrawerProps) {
  if (!open) return null;

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

        {/* Seção Principal */}
        <div className="flex-1 overflow-y-auto scrollbar-custom">
          <NavSection
            title="PRINCIPAL"
            items={mainItems}
            activeItem={activeItem}
            onItemClick={(id, path) => {
              onItemClick(id, path);
              onClose();
            }}
          />
        </div>

        {/* Divisor */}
        <div className="mx-4 my-4">
          <div className="h-px bg-[#E5E7EB] dark:bg-gray-700" />
        </div>

        {/* Seção Configurações */}
        <NavSection
          title="CONFIGURAÇÕES"
          items={settingsItems}
          isSecondary
          onItemClick={(id, path) => {
            onItemClick(id, path);
            onClose();
          }}
        />

        {/* Footer */}
        <SidebarFooter onMenuToggle={onMenuToggle} />
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
