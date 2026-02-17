import { useNavigate } from 'react-router-dom';
import { OmniseenLogo } from '@/components/ui/OmniseenLogo';
import { cn } from '@/lib/utils';

interface SidebarHeaderProps {
  isExpanded?: boolean;
}

export function SidebarHeader({ isExpanded }: SidebarHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className={cn(
      "h-16 flex items-center border-b border-[#E5E7EB] dark:border-gray-700",
      isExpanded ? 'px-4 gap-3' : 'justify-center'
    )}>
      <button
        onClick={() => navigate('/client/dashboard')}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50 rounded-lg p-1 -m-1"
        aria-label="Ir para Dashboard"
      >
        <OmniseenLogo size={isExpanded ? 'md' : 'sidebar-collapsed'} className="shrink-0" />
        {isExpanded && (
          <span className="text-lg font-semibold text-[#111827] dark:text-white whitespace-nowrap">
            OmniSeen
          </span>
        )}
      </button>
    </div>
  );
}
