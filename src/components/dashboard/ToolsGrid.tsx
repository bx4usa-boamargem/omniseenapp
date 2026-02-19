import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Layers, LayoutTemplate, RefreshCw } from 'lucide-react';
import { ToolCard } from './ToolCard';
import { ComingSoonModal } from '@/components/shared/ComingSoonModal';

interface Tool {
  id: string;
  icon: React.ElementType;
  name: string;
  description: string;
  tag?: { emoji: string; text: string };
  path: string;
  comingSoon?: boolean;
}

const TOOLS: Tool[] = [
  {
    id: 'one-click',
    icon: FileText,
    name: 'Postagem de Blog com 1 Clique',
    description: 'Crie o artigo perfeito usando apenas o título. Gere e publique com um clique.',
    tag: { emoji: '⚡', text: 'Relâmpago' },
    path: '/client/articles/engine/new',
  },
  {
    id: 'bulk',
    icon: Layers,
    name: 'Geração de Artigos em Massa',
    description: 'Gere até 100 artigos automaticamente em lote.',
    tag: { emoji: '😱', text: 'Poder que assusta' },
    path: '/client/bulk-create',
    comingSoon: true,
  },
  {
    id: 'super-page',
    icon: LayoutTemplate,
    name: 'Super Página',
    description: 'Crie páginas de alta conversão baseadas na SERP.',
    tag: { emoji: '🚀', text: 'Foguete de Conversão' },
    path: '/client/landing-pages/new',
  },
  {
    id: 'rewrite',
    icon: RefreshCw,
    name: 'Ferramenta de Reescrita',
    description: 'Transforme textos em conteúdo pronto para SEO.',
    tag: { emoji: '🆕', text: 'Novo' },
    path: '/client/rewrite',
    comingSoon: true,
  },
];

export function ToolsGrid() {
  const navigate = useNavigate();
  const [comingSoonModal, setComingSoonModal] = useState<{ open: boolean; name: string }>({
    open: false,
    name: '',
  });

  const handleToolClick = (tool: Tool) => {
    if (tool.comingSoon) {
      setComingSoonModal({ open: true, name: tool.name });
    } else {
      navigate(tool.path);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Ferramentas</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TOOLS.map((tool) => (
            <ToolCard
              key={tool.id}
              icon={tool.icon}
              name={tool.name}
              description={tool.description}
              tag={tool.tag}
              onClick={() => handleToolClick(tool)}
            />
          ))}
        </div>
      </div>

      <ComingSoonModal
        open={comingSoonModal.open}
        onOpenChange={(open) => setComingSoonModal({ ...comingSoonModal, open })}
        featureName={comingSoonModal.name}
      />
    </>
  );
}
