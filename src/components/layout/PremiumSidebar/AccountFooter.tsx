import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useBlog } from '@/hooks/useBlog';
import { cn } from '@/lib/utils';
import { AccountHubPanel } from './AccountHubPanel';

interface AccountFooterProps {
  onNavigate: (path: string) => void;
  onLogout: () => void;
  currentPath?: string;
  isExpanded?: boolean;
}

/**
 * Footer da sidebar que funciona como HUB da conta
 * - Exibe avatar + nome do workspace
 * - Clique abre painel flutuante para CIMA com todas as opções de conta/sistema
 */
export function AccountFooter({ onNavigate, onLogout, currentPath, isExpanded = true }: AccountFooterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();
  const { blog } = useBlog();

  const displayName = blog?.name || user?.email?.split('@')[0] || 'Workspace';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleNavigateAndClose = (path: string) => {
    onNavigate(path);
    setIsOpen(false);
  };

  const handleLogoutAndClose = () => {
    setIsOpen(false);
    onLogout();
  };

  return (
    <div className="relative border-t border-[#E5E7EB] dark:border-gray-700 p-4">
      {/* Botão do Workspace */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all cursor-pointer',
          'hover:bg-[#F9FAFB] dark:hover:bg-gray-800 hover:shadow-sm',
          isOpen && 'bg-[#F9FAFB] dark:bg-gray-800'
        )}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Abrir menu da conta"
      >
        {/* Avatar gradient */}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#7C3AED] flex items-center justify-center shrink-0">
          <span className="text-white font-semibold text-sm">{initials}</span>
        </div>

        {isExpanded && (
          <>
            {/* Info */}
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-semibold text-[#111827] dark:text-white truncate">
                {displayName}
              </p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
                <span className="text-xs text-[#6B7280]">Plano Growth</span>
              </div>
            </div>

            {/* Chevron - aponta para cima quando aberto */}
            <ChevronUp
              className={cn(
                'h-4 w-4 text-[#9CA3AF] transition-transform duration-200 shrink-0',
                !isOpen && 'rotate-180'
              )}
            />
          </>
        )}
      </button>

      {/* Menu Flutuante - Abre para CIMA */}
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Card flutuante - posicionado ACIMA do botão */}
          <div
            className={cn(
              'absolute bottom-full left-0 right-0 mb-2 z-50',
              'bg-white dark:bg-gray-900 rounded-xl',
              'shadow-[0_-10px_40px_rgba(0,0,0,0.15),0_0_1px_rgba(0,0,0,0.1)]',
              'border border-[#E5E7EB] dark:border-gray-700',
              'animate-in slide-in-from-bottom-2 duration-200',
              'max-h-[70vh] overflow-y-auto scrollbar-custom'
            )}
            role="menu"
            aria-label="Menu da conta"
          >
            {/* Header fixo */}
            <div className="sticky top-0 bg-white dark:bg-gray-900 px-4 py-3 border-b border-[#E5E7EB] dark:border-gray-700 z-10">
              <h3 className="text-sm font-semibold text-[#111827] dark:text-white">
                Minha Conta
              </h3>
            </div>

            <AccountHubPanel
              onNavigate={handleNavigateAndClose}
              onLogout={handleLogoutAndClose}
              currentPath={currentPath}
            />
          </div>
        </>
      )}
    </div>
  );
}
