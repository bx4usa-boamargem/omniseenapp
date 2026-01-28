import { useNavigate } from 'react-router-dom';
import { X, User, Building2, Target, Bell, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UserMenuProps {
  onClose: () => void;
}

const accountMenuItems = [
  {
    id: 'profile',
    icon: User,
    iconBg: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    title: 'Perfil',
    subtitle: 'Dados pessoais e preferências',
    path: '/client/account',
  },
  {
    id: 'company',
    icon: Building2,
    iconBg: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    title: 'Empresa',
    subtitle: 'Informações do negócio',
    path: '/client/company',
  },
  {
    id: 'strategy',
    icon: Target,
    iconBg: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    title: 'Estratégia SEO',
    subtitle: 'Palavras-chave e configurações',
    path: '/client/radar',
  },
  {
    id: 'notifications',
    icon: Bell,
    iconBg: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    title: 'Notificações',
    subtitle: 'E-mails e alertas',
    path: '/client/settings?tab=notifications',
  },
];

/**
 * Menu flutuante do usuário
 * - Posição fixa à direita da sidebar (left-[296px])
 * - Overlay com clique para fechar
 */
export function UserMenu({ onClose }: UserMenuProps) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logout realizado com sucesso');
      navigate('/auth');
    } catch (error) {
      toast.error('Erro ao fazer logout');
    }
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-[49] animate-in fade-in duration-150 cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu Flutuante - Posição fixa */}
      <div
        className={cn(
          'fixed bottom-[90px] left-[296px] z-50 w-[280px] bg-white dark:bg-gray-900 rounded-xl',
          'shadow-[0_10px_40px_rgba(0,0,0,0.15),0_0_1px_rgba(0,0,0,0.1)]',
          'border border-[#E5E7EB] dark:border-gray-700',
          'animate-in zoom-in-95 fade-in duration-200'
        )}
        role="menu"
        aria-label="Menu da conta"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#F3F4F6] dark:border-gray-700">
          <span className="font-semibold text-[15px] text-[#111827] dark:text-white">
            Minha Conta
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#F3F4F6] dark:hover:bg-gray-700 transition-colors"
            aria-label="Fechar menu"
          >
            <X className="h-[18px] w-[18px] text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white" />
          </button>
        </div>

        {/* Menu Items */}
        <div className="p-2 space-y-1">
          {accountMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.path)}
              className="w-full flex items-start gap-3 px-3 py-3 rounded-lg hover:bg-[#F9FAFB] dark:hover:bg-gray-800 hover:scale-[1.02] transition-all cursor-pointer"
              role="menuitem"
            >
              {/* Ícone circular colorido */}
              <div className={cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', item.iconBg)}>
                <item.icon className="h-4 w-4" />
              </div>

              {/* Texto */}
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-[#111827] dark:text-white">{item.title}</p>
                <p className="text-xs text-[#6B7280] mt-0.5">{item.subtitle}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Footer - Sair */}
        <div className="border-t border-[#F3F4F6] dark:border-gray-700 p-2">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-[#EF4444] hover:bg-[#FEE2E2] dark:hover:bg-red-900/20 rounded-lg transition-colors"
            role="menuitem"
          >
            <LogOut className="h-4 w-4" />
            <span className="text-sm font-medium">Sair</span>
          </button>
        </div>
      </div>
    </>
  );
}
