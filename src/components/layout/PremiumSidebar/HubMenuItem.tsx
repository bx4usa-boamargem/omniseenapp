import { useState, useRef, useEffect, ReactNode } from 'react';
import { LucideIcon, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface HubMenuItemProps {
  id: string;
  icon: LucideIcon;
  label: string;
  isActive?: boolean;
  isExpanded?: boolean;
  children: ReactNode;
  onClose?: () => void;
}

interface PanelPosition {
  top: number;
  left: number;
}

/**
 * Hub menu item com menu flutuante
 * - Abre ao hover ou click
 * - Fecha ao sair ou clicar fora
 * - Faixa lateral roxo→laranja quando ativo
 * - Usa position: fixed para evitar clipping por overflow
 */
export function HubMenuItem({ 
  id, 
  icon: Icon, 
  label, 
  isActive,
  isExpanded = true,
  children,
  onClose 
}: HubMenuItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>({ top: 0, left: 0 });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o menu quando o sidebar colapsa
  useEffect(() => {
    if (!isExpanded) {
      setIsOpen(false);
    }
  }, [isExpanded]);

  // Calcula posição do painel quando abre
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPanelPosition({
        top: rect.top,
        left: rect.right + 12,
      });
    }
  }, [isOpen]);

  // Fecha ao clicar fora (sem overlay bloqueante)
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Also check if click is inside the fixed panel
        const panel = document.querySelector(`[data-hub-panel="${id}"]`);
        if (panel && panel.contains(e.target as Node)) return;
        setIsOpen(false);
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, id, onClose]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (isExpanded) {
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const handleClick = () => {
    setIsOpen(!isOpen);
  };

  const handleCloseMenu = () => {
    setIsOpen(false);
    onClose?.();
  };

  return (
    <div 
      ref={containerRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Botão Principal */}
      {(() => {
        const btn = (
          <button
            onClick={handleClick}
            className={cn(
              'w-full flex items-center gap-3 py-3 rounded-lg relative',
              'transition-all duration-200',
              isExpanded ? 'mx-2 px-4' : 'justify-center',
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
            aria-expanded={isOpen}
            aria-haspopup="menu"
          >
            {/* Faixa lateral ativa (roxo → laranja) */}
            {isActive && (
              <div 
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full"
                style={{ 
                  background: 'linear-gradient(to bottom, #7C3AED, #F97316)' 
                }}
              />
            )}
            
            <Icon className={cn(
              'h-5 w-5 shrink-0 transition-colors',
              isActive && 'text-[#7C3AED]'
            )} />
            
            {isExpanded && (
              <>
                <span className="flex-1 text-left text-sm font-medium whitespace-nowrap">
                  {label}
                </span>
                
                <ChevronRight className={cn(
                  'h-4 w-4 text-[#9CA3AF] transition-transform duration-200',
                  isOpen && 'rotate-90'
                )} />
              </>
            )}
          </button>
        );

        if (!isExpanded) {
          return (
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>{btn}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {label}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        }

        return btn;
      })()}

      {/* Menu Flutuante - Position Fixed */}
      {isOpen && (
        <div 
          className={cn(
            'fixed z-[110]',
            'w-80 bg-white dark:bg-gray-900 rounded-xl',
            'shadow-[0_10px_40px_rgba(0,0,0,0.15)]',
            'border border-[#E5E7EB] dark:border-gray-700',
            'animate-in slide-in-from-left-2 duration-200',
            'max-h-[80vh] overflow-y-auto'
          )}
          style={{
            top: panelPosition.top,
            left: panelPosition.left,
          }}
          role="menu"
          aria-label={`Menu ${label}`}
          data-hub-panel={id}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {children}
        </div>
      )}
    </div>
  );
}
