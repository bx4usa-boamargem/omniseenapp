import { useNavigate } from 'react-router-dom';
import { OmniseenLogo } from '@/components/ui/OmniseenLogo';
import { cn } from '@/lib/utils';

interface SidebarHeaderProps {
  isExpanded?: boolean;
}

export function SidebarHeader({ isExpanded }: SidebarHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="h-20 flex items-center px-3 gap-3 border-b border-[#E5E7EB] dark:border-gray-700">
      <button
        onClick={() => navigate('/client/dashboard')}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50 rounded-lg p-1 -m-1"
        aria-label="Ir para Dashboard"
      >
        <OmniseenLogo size="sidebar" className="shrink-0" />
        <span
          className={cn(
            'text-lg font-semibold text-[#111827] dark:text-white whitespace-nowrap',
            'transition-opacity duration-200',
            isExpanded ? 'opacity-100' : 'opacity-0'
          )}
        >
          OmniSeen
        </span>
      </button>
    </div>
  );
}
