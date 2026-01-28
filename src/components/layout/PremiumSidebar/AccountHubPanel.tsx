import { useState } from 'react';
import {
  User,
  Building2,
  Target,
  Settings,
  CreditCard,
  Plug,
  Bell,
  HelpCircle,
  Moon,
  Sun,
  LogOut,
  ChevronDown,
  ExternalLink,
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
    subtitle: 'Dados pessoais',
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
    subtitle: 'Palavras-chave e posicionamento',
    path: '/client/radar',
  },
];

const settingsItems = [
  {
    id: 'settings',
    icon: Settings,
    iconBg: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
    title: 'Configurações',
    subtitle: 'Preferências do sistema',
    path: '/client/settings',
  },
  {
    id: 'billing',
    icon: CreditCard,
    iconBg: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    title: 'Plano & Cobrança',
    subtitle: 'Assinatura e pagamentos',
    path: '/client/settings?tab=billing',
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

const integrationItems = [
  { id: 'wordpress', title: 'WordPress', path: '/client/integrations/wordpress', available: true },
  { id: 'wix', title: 'Wix', path: '/client/integrations/wix', available: true },
  { id: 'gmail', title: 'Gmail', path: '/client/integrations/gmail', available: false, badge: 'Em breve' },
  { id: 'calendar', title: 'Google Calendar', path: '/client/integrations/calendar', available: false, badge: 'Em breve' },
];

/**
 * Painel flutuante do hub "Conta"
 * Inclui: Perfil, Empresa, Estratégia, Configurações, Integrações expandidas, Tema e Logout
 */
export function AccountHubPanel({ onNavigate, onLogout, currentPath }: AccountHubPanelProps) {
  const { theme, setTheme } = useTheme();
  const [integrationsExpanded, setIntegrationsExpanded] = useState(false);
  const isDark = theme === 'dark';

  const isCurrentRoute = (path: string) => {
    const cleanPath = path.replace('/client', '').split('?')[0];
    return currentPath?.includes(cleanPath);
  };

  const renderItem = (item: (typeof accountItems)[0]) => (
    <button
      key={item.id}
      onClick={() => onNavigate(item.path)}
      className={cn(
        'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg',
        'hover:bg-[#F9FAFB] dark:hover:bg-gray-800 transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50',
        isCurrentRoute(item.path) && 'bg-[#F3F4F6] dark:bg-gray-800'
      )}
      role="menuitem"
    >
      <div
        className={cn(
          'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
          item.iconBg
        )}
      >
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

  return (
    <div className="py-2">
      {/* Seção: Conta */}
      <div className="px-4 py-2">
        <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
          Conta
        </h3>
      </div>
      <div className="px-2 space-y-0.5">{accountItems.map(renderItem)}</div>

      {/* Separador */}
      <div className="mx-4 my-3 h-px bg-[#E5E7EB] dark:bg-gray-700" />

      {/* Seção: Sistema */}
      <div className="px-4 py-2">
        <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
          Sistema
        </h3>
      </div>
      <div className="px-2 space-y-0.5">{settingsItems.map(renderItem)}</div>

      {/* Integrações com sub-itens expandíveis */}
      <div className="px-2 mt-0.5">
        <button
          onClick={() => setIntegrationsExpanded(!integrationsExpanded)}
          className={cn(
            'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg',
            'hover:bg-[#F9FAFB] dark:hover:bg-gray-800 transition-colors'
          )}
          role="menuitem"
          aria-expanded={integrationsExpanded}
        >
          <div
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
              'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
            )}
          >
            <Plug className="h-4 w-4" />
          </div>

          <div className="flex-1 text-left min-w-0">
            <span className="text-sm font-medium text-[#111827] dark:text-white block">
              Integrações
            </span>
            <p className="text-xs text-[#6B7280] dark:text-gray-500 truncate">
              Conecte suas ferramentas
            </p>
          </div>

          <ChevronDown
            className={cn(
              'h-4 w-4 text-[#9CA3AF] transition-transform duration-200 mt-2',
              integrationsExpanded && 'rotate-180'
            )}
          />
        </button>

        {/* Sub-itens das integrações */}
        {integrationsExpanded && (
          <div className="ml-12 mt-1 space-y-1 border-l-2 border-[#E5E7EB] dark:border-gray-700 pl-3">
            {integrationItems.map((item) => (
              <button
                key={item.id}
                onClick={() => item.available && onNavigate(item.path)}
                disabled={!item.available}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm',
                  item.available
                    ? 'hover:bg-[#F9FAFB] dark:hover:bg-gray-800 text-[#111827] dark:text-white cursor-pointer'
                    : 'text-[#9CA3AF] dark:text-gray-600 cursor-not-allowed'
                )}
              >
                <span className="flex items-center gap-2">
                  {item.title}
                  {item.available && (
                    <ExternalLink className="h-3 w-3 text-[#9CA3AF]" />
                  )}
                </span>
                {item.badge && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F3F4F6] dark:bg-gray-800 text-[#6B7280]">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
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
          <div
            className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
              'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            )}
          >
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

          <span className="text-sm font-medium">Sair</span>
        </button>
      </div>
    </div>
  );
}
