import { useNavigate } from 'react-router-dom';

/**
 * Header da sidebar com logo fixa
 * - Logo 40x40px com letra "O"
 * - Nome "OmnisEen" sempre visível
 * - Sem botão PIN (removido)
 */
export function SidebarHeader() {
  const navigate = useNavigate();

  return (
    <div className="h-20 flex items-center px-4 gap-3 border-b border-[#E5E7EB] dark:border-gray-700">
      {/* Logo */}
      <button
        onClick={() => navigate('/client/dashboard')}
        className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7C3AED] to-[#3B82F6] flex items-center justify-center hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50"
        aria-label="Ir para Dashboard"
      >
        <span className="text-white font-bold text-lg">O</span>
      </button>

      {/* Nome "OmnisEen" */}
      <span className="text-lg font-semibold text-[#111827] dark:text-white">
        OmnisEen
      </span>
    </div>
  );
}
