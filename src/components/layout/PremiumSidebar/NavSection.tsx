import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavItem } from './NavItem';

export interface NavItemConfig {
  id: string;
  icon: LucideIcon;
  label: string;
  path?: string;
  highlight?: boolean;
  badge?: string | number;
  badgeType?: 'default' | 'success' | 'purple';
  badgeIcon?: LucideIcon;
  pulseDot?: boolean;
  isThemeToggle?: boolean;
}

interface NavSectionProps {
  title: string;
  items: NavItemConfig[];
  activeItem?: string;
  onItemClick?: (id: string, path?: string) => void;
  isSecondary?: boolean;
}

/**
 * Seção de navegação com label e grupo de itens
 * - PRINCIPAL: fundo branco
 * - CONFIGURAÇÕES: fundo #FAFAFA
 * Versão simplificada (sem animações de stagger)
 */
export function NavSection({
  title,
  items,
  activeItem,
  onItemClick,
  isSecondary,
}: NavSectionProps) {
  return (
    <div
      className={cn(
        'py-2',
        isSecondary && 'bg-[#FAFAFA] dark:bg-gray-800/50'
      )}
    >
      {/* Label da seção */}
      <div className="px-5 py-2">
        <span className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[0.05em]">
          {title}
        </span>
      </div>

      {/* Itens */}
      <div className="space-y-0.5 px-2">
        {items.map((item) => (
          <NavItem
            key={item.id}
            {...item}
            isActive={activeItem === item.id}
            isSecondary={isSecondary}
            onClick={() => onItemClick?.(item.id, item.path)}
          />
        ))}
      </div>
    </div>
  );
}
