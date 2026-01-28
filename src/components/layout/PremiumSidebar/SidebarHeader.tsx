import { useNavigate } from 'react-router-dom';
import { OmniseenLogo } from '@/components/ui/OmniseenLogo';

/**
 * Header da sidebar com logo oficial OmniSeen
 * - Logo oficial da marca
 * - Nome "OmniSeen" sempre visível
 * - Clique leva ao Dashboard
 */
export function SidebarHeader() {
  const navigate = useNavigate();

  return (
    <div className="h-20 flex items-center px-4 gap-3 border-b border-[#E5E7EB] dark:border-gray-700">
      <button
        onClick={() => navigate('/client/dashboard')}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50 rounded-lg p-1 -m-1"
        aria-label="Ir para Dashboard"
      >
        <OmniseenLogo size="sidebar" />
        <span className="text-lg font-semibold text-[#111827] dark:text-white">
          OmniSeen
        </span>
      </button>
    </div>
  );
}
