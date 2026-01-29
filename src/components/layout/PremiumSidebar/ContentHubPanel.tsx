import { Radar, Sparkles, FileText, Globe, LayoutTemplate } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContentHubPanelProps {
  onNavigate: (path: string) => void;
  currentPath?: string;
}

const contentItems = [
  {
    id: 'radar',
    icon: Radar,
    iconBg: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    title: 'Radar de Oportunidades',
    subtitle: 'Descubra o que sua cidade procura',
    path: '/client/radar',
  },
  {
    id: 'generate',
    icon: Sparkles,
    iconBg: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
    title: 'Gerar Artigo',
    subtitle: 'Controle total: nicho, template, E-E-A-T',
    path: '/client/articles/generate',
    highlight: true,
  },
  {
    id: 'articles',
    icon: FileText,
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
    title: 'Meus Artigos',
    subtitle: 'Gerencie seus posts e rascunhos',
    path: '/client/articles',
  },
  {
    id: 'portal',
    icon: Globe,
    iconBg: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    title: 'Blogs / Portais',
    subtitle: 'Seus sites e mini-sites',
    path: '/client/portal',
  },
  {
    id: 'landing-pages',
    icon: LayoutTemplate,
    iconBg: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
    title: 'Páginas SEO',
    subtitle: 'Crie páginas locais de conversão',
    path: '/client/landing-pages',
  },
];

/**
 * Painel flutuante do hub "Conteúdo"
 * Exibe cards com ícones coloridos e descrições
 */
export function ContentHubPanel({ onNavigate, currentPath }: ContentHubPanelProps) {
  return (
    <div className="p-3 space-y-1">
      <div className="px-3 py-2 mb-2">
        <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wider">
          Conteúdo
        </h3>
      </div>
      
      {contentItems.map((item) => {
        const isCurrentRoute = currentPath?.includes(item.path.replace('/client', ''));
        
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.path)}
            className={cn(
              'w-full flex items-start gap-3 px-3 py-3 rounded-lg',
              'hover:bg-[#F9FAFB] dark:hover:bg-gray-800 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50',
              item.highlight && 'ring-1 ring-purple-200 dark:ring-purple-800 bg-purple-50/50 dark:bg-purple-900/10',
              isCurrentRoute && 'bg-[#F3F4F6] dark:bg-gray-800'
            )}
            role="menuitem"
          >
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
              item.iconBg
            )}>
              <item.icon className="h-5 w-5" />
            </div>
            
            <div className="flex-1 text-left min-w-0">
              <span className={cn(
                'text-sm font-medium text-[#111827] dark:text-white block',
                item.highlight && 'text-purple-700 dark:text-purple-300'
              )}>
                {item.title}
              </span>
              <p className="text-xs text-[#6B7280] dark:text-gray-500 mt-0.5 truncate">
                {item.subtitle}
              </p>
            </div>

            {item.highlight && (
              <span className="px-2 py-0.5 bg-[#7C3AED] text-white text-[10px] font-bold rounded-full shrink-0">
                IA
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
