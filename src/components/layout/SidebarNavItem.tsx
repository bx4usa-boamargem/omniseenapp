import { ReactNode, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface SidebarNavItemProps {
  icon: React.ElementType;
  label: string;
  isActive: boolean;
  disabled?: boolean;
  panel?: ReactNode;
  onClick?: () => void;
}

export function SidebarNavItem({
  icon: Icon,
  label,
  isActive,
  disabled,
  panel,
  onClick,
}: SidebarNavItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    // Small delay to allow moving to the panel
    timeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 150);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Icon Button */}
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'relative w-10 h-10 rounded-xl flex items-center justify-center',
          'transition-all duration-200 cursor-pointer',
          'text-muted-foreground hover:text-orange-500 hover:bg-orange-500/10',
          isActive && [
            'text-orange-500',
            'bg-orange-500/15',
            'before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2',
            'before:w-[3px] before:h-6 before:bg-orange-500 before:rounded-r-full'
          ],
          disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground'
        )}
        aria-label={label}
      >
        <Icon className="h-5 w-5" />
      </button>

      {/* Floating Panel */}
      {panel && (
        <div
          className={cn(
            'absolute left-full top-0 ml-3 z-50',
            'transition-all duration-200',
            isHovered
              ? 'opacity-100 visible translate-x-0'
              : 'opacity-0 invisible -translate-x-2 pointer-events-none'
          )}
        >
          {panel}
        </div>
      )}
    </div>
  );
}
