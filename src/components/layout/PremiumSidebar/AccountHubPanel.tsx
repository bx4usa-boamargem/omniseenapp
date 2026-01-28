import { 
  User, 
  Building2, 
  Target, 
  CreditCard, 
  Plug, 
  Bell, 
  HelpCircle, 
  Moon, 
  Sun, 
  LogOut 
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

interface AccountHubPanelProps {
  onNavigate: (path: string) => void;
  onLogout: () => void;
  currentPath?: string;
}

const accountItems = [
  {
    id: 'profile',
    icon: User,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    title: 'Perfil',
    subtitle: 'Dados pessoais e preferências',
    path: '/client/account',
  },
  {
    id: 'company',
    icon: Building2,
    iconBg: 'bg-slate-100 dark:bg-slate-900/30 text-slate-600 dark:text-slate-400',
    title: 'Empresa',
    subtitle: 'Informações do negócio',
    path: '/client/company',
  },
  {
    id: 'strategy',
    icon: Target,
    iconBg: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
    title: 'Estratégia SEO',
    subtitle: 'Palavras-chave e metas',
    path: '/client/radar',
  },
];

const settingsItems = [
  {
    id: 'billing',
    icon: CreditCard,
    iconBg: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    title: 'Plano & Cobrança',
    subtitle: 'Gerencie sua assinatura',
    path: '/client/settings?tab=billing',
  },
  {
    id: 'integrations',
    icon: Plug,
    iconBg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    title: 'Integrações',
    subtitle: 'Conecte suas ferramentas',
    path: '/client/settings?tab=integrations',
  },
  {
    id: 'notifications',
    icon: Bell,
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
    title: 'Notificações',
    subtitle: 'E-mails e alertas',
    path: '/client/settings?tab=notifications',
  },
  {
    id: 'help',
    icon: HelpCircle,
    iconBg: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
    title: 'Ajuda & Suporte',
    subtitle: 'Central de ajuda',
    path: '/client/help',
  },
];

/**
 * Painel flutuante do hub "Conta & Sistema"
 * Inclui toggle de tema e botão de logout
 */
export function AccountHubPanel({ onNavigate, onLogout, currentPath }: AccountHubPanelProps) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  const renderItem = (item: typeof accountItems[0]) => {
    const isCurrentRoute = currentPath?.includes(item.path.replace('/client', '').split('?')[0]);
    
    return (
      <button
        key={item.id}
        onClick={() => onNavigate(item.path)}
        className={cn(
          'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg',
          'hover:bg-[#F9FAFB] dark:hover:bg-gray-800 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50',
          isCurrentRoute && 'bg-[#F3F4F6] dark:bg-gray-800'
        )}
        role="menuitem"
      >
        <div className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
          item.iconBg
        )}>
          <item.icon className="h-4 w-4" />
        </div>
        
        <div className="flex-1 text-left min-w-0">
          <span className="text-sm font-medium text-[#111827] dark:text-white block">
            {item.title}
          </span>
          <p className="text-xs text-[#6B7280] dark:text-gray-500 truncate">
            {item.subtitle}
          </p>
        </div>
      </button>
    );
  };

  return (
    <div className="py-2">
      {/* Seção: Conta */}
      <div className="px-4 py-2">
        <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
          Conta
        </h3>
      </div>
      <div className="px-2 space-y-0.5">
        {accountItems.map(renderItem)}
      </div>

      {/* Separador */}
      <div className="mx-4 my-3 h-px bg-[#E5E7EB] dark:bg-gray-700" />

      {/* Seção: Configurações */}
      <div className="px-4 py-2">
        <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
          Configurações
        </h3>
      </div>
      <div className="px-2 space-y-0.5">
        {settingsItems.map(renderItem)}
      </div>

      {/* Separador */}
      <div className="mx-4 my-3 h-px bg-[#E5E7EB] dark:bg-gray-700" />

      {/* Toggle de Tema */}
      <div className="px-2">
        <button
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
            'hover:bg-[#F9FAFB] dark:hover:bg-gray-800 transition-colors'
          )}
          role="menuitem"
        >
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
            'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          )}>
            {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </div>
          
          <span className="flex-1 text-left text-sm font-medium text-[#111827] dark:text-white">
            Tema
          </span>

          {/* Toggle Switch */}
          <div
            className={cn(
              'w-10 h-6 rounded-full transition-colors duration-200 relative',
              isDark ? 'bg-[#7C3AED]' : 'bg-[#E5E7EB]'
            )}
          >
            <div
              className={cn(
                'absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200',
                isDark ? 'translate-x-5' : 'translate-x-1'
              )}
            />
          </div>
        </button>
      </div>

      {/* Separador */}
      <div className="mx-4 my-3 h-px bg-[#E5E7EB] dark:bg-gray-700" />

      {/* Botão Sair */}
      <div className="px-2 pb-2">
        <button
          onClick={onLogout}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
            'text-red-600 dark:text-red-400',
            'hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors'
          )}
          role="menuitem"
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-red-100 dark:bg-red-900/30">
            <LogOut className="h-4 w-4" />
          </div>
          
          <span className="text-sm font-medium">
            Sair
          </span>
        </button>
      </div>
    </div>
  );
}
