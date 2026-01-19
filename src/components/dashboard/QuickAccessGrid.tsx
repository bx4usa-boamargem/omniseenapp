import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  Home, FileText, Plus, BookOpen, Calendar, Target, Search as SearchIcon,
  BarChart3, TrendingUp, Settings, Users, CreditCard, HelpCircle, Globe,
  Shield, Layers, Star, Zap, ChevronDown, User, Megaphone, UserPlus, Users2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFavoritePages } from "@/hooks/useFavoritePages";
import { useConfetti } from "@/hooks/useConfetti";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface QuickAccessGridProps {
  blogSlug?: string;
  isPlatformAdmin?: boolean;
}

interface PageItem {
  title: string;
  route: string;
  icon: React.ElementType;
  keywords: string[];
  category: string;
  external?: boolean;
  adminOnly?: boolean;
}

const categoryColors: Record<string, { bg: string; icon: string; text: string }> = {
  conteudo: { bg: "bg-blue-500/10 hover:bg-blue-500/20", icon: "text-blue-500", text: "text-blue-600" },
  estrategia: { bg: "bg-purple-500/10 hover:bg-purple-500/20", icon: "text-purple-500", text: "text-purple-600" },
  analise: { bg: "bg-green-500/10 hover:bg-green-500/20", icon: "text-green-500", text: "text-green-600" },
  gestao: { bg: "bg-orange-500/10 hover:bg-orange-500/20", icon: "text-orange-500", text: "text-orange-600" },
  suporte: { bg: "bg-cyan-500/10 hover:bg-cyan-500/20", icon: "text-cyan-500", text: "text-cyan-600" },
  externo: { bg: "bg-pink-500/10 hover:bg-pink-500/20", icon: "text-pink-500", text: "text-pink-600" },
  admin: { bg: "bg-red-500/10 hover:bg-red-500/20", icon: "text-red-500", text: "text-red-600" },
};

const categoryLabels: Record<string, { label: string; icon: React.ElementType }> = {
  conteudo: { label: "Conteúdo", icon: FileText },
  estrategia: { label: "Estratégia", icon: Target },
  analise: { label: "Análise", icon: BarChart3 },
  gestao: { label: "Gestão", icon: Settings },
  suporte: { label: "Suporte", icon: HelpCircle },
  externo: { label: "Externo", icon: Globe },
  admin: { label: "Admin", icon: Shield },
};

const categoryOrder = ["conteudo", "estrategia", "analise", "gestao", "suporte", "externo", "admin"];

const getPages = (blogSlug?: string): PageItem[] => [
  // Conteúdo
  { title: 'Início', route: '/app/dashboard', icon: Home, keywords: ['home', 'dashboard', 'painel'], category: 'conteudo' },
  { title: 'Conteúdos', route: '/app/articles', icon: FileText, keywords: ['artigos', 'posts', 'blog'], category: 'conteudo' },
  { title: 'Novo Artigo', route: '/app/articles/new', icon: Plus, keywords: ['criar', 'adicionar', 'escrever'], category: 'conteudo' },
  { title: 'Ebooks', route: '/app/ebooks', icon: BookOpen, keywords: ['livros', 'pdf', 'download'], category: 'conteudo' },
  { title: 'Calendário', route: '/app/calendar', icon: Calendar, keywords: ['agenda', 'programar', 'datas'], category: 'conteudo' },
  // Estratégia
  { title: 'Estratégia', route: '/app/strategy', icon: Target, keywords: ['plano', 'negócio', 'persona'], category: 'estrategia' },
  { title: 'Palavras-chave', route: '/app/keywords', icon: SearchIcon, keywords: ['seo', 'pesquisa', 'termos'], category: 'estrategia' },
  { title: 'Clusters', route: '/app/clusters', icon: Layers, keywords: ['agrupamento', 'temas', 'pillar'], category: 'estrategia' },
  // Análise
  { title: 'Análise SEO', route: '/app/performance', icon: TrendingUp, keywords: ['métricas', 'resultados', 'crescimento', 'seo', 'desempenho'], category: 'analise' },
  { title: 'Analytics', route: '/app/analytics', icon: BarChart3, keywords: ['estatísticas', 'dados', 'gráficos'], category: 'analise' },
  // Gestão
  { title: 'Automações', route: '/app/automation', icon: Zap, keywords: ['auto', 'automático', 'programar'], category: 'gestao' },
  { title: 'Configurações', route: '/app/settings', icon: Settings, keywords: ['config', 'preferências', 'ajustes'], category: 'gestao' },
  { title: 'Conta', route: '/app/account', icon: Users, keywords: ['time', 'equipe', 'membros'], category: 'gestao' },
  { title: 'Perfil', route: '/app/profile', icon: User, keywords: ['meu perfil', 'avatar', 'dados'], category: 'gestao' },
  { title: 'Assinatura', route: '/app/subscription', icon: CreditCard, keywords: ['plano', 'pagamento', 'upgrade', 'billing', 'pro'], category: 'gestao' },
  // Suporte
  { title: 'Ajuda', route: '/help', icon: HelpCircle, keywords: ['suporte', 'faq', 'dúvidas'], category: 'suporte' },
  // Externo
  
  { title: 'Ver Blog', route: blogSlug ? `/blog/${blogSlug}` : '/blog', icon: Globe, keywords: ['site', 'público', 'visualizar'], category: 'externo', external: true },
  // Admin
  { title: 'Criar Subconta', route: '/admin?tab=customer-accounts', icon: UserPlus, keywords: ['cliente', 'conta', 'manual', 'subconta'], category: 'admin', adminOnly: true },
  { title: 'Equipe Interna', route: '/admin?tab=internal-staff', icon: Users2, keywords: ['staff', 'funcionário', 'interno'], category: 'admin', adminOnly: true },
  { title: 'Admin', route: '/admin', icon: Shield, keywords: ['administrador', 'gestão', 'custos'], category: 'admin', adminOnly: true },
];

export const QuickAccessGrid = ({ blogSlug, isPlatformAdmin }: QuickAccessGridProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toggleFavorite, isFavorite } = useFavoritePages();
  const { fireStarConfetti } = useConfetti();

  const allPages = useMemo(() => {
    const pages = getPages(blogSlug);
    return pages.filter(page => !page.adminOnly || isPlatformAdmin);
  }, [blogSlug, isPlatformAdmin]);

  const filteredPages = useMemo(() => {
    if (!searchQuery.trim()) return allPages;
    const query = searchQuery.toLowerCase();
    return allPages.filter(page =>
      page.title.toLowerCase().includes(query) ||
      page.keywords.some(k => k.toLowerCase().includes(query))
    );
  }, [allPages, searchQuery]);

  const favoritePages = useMemo(() => {
    return allPages.filter(page => isFavorite(page.route));
  }, [allPages, isFavorite]);

  const groupedPages = useMemo(() => {
    const groups: Record<string, PageItem[]> = {};
    filteredPages.forEach(page => {
      if (!groups[page.category]) groups[page.category] = [];
      groups[page.category].push(page);
    });
    return groups;
  }, [filteredPages]);

  // Keyboard shortcut: Ctrl+K to open and focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Clear search when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  const handleToggleFavorite = (route: string, event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const wasAlreadyFavorite = isFavorite(route);
    toggleFavorite(route);

    if (!wasAlreadyFavorite) {
      const x = event.clientX / window.innerWidth;
      const y = event.clientY / window.innerHeight;
      fireStarConfetti(x, y);
    }
  };

  const MenuCard = ({ page }: { page: PageItem }) => {
    const color = categoryColors[page.category];
    const isFav = isFavorite(page.route);

    const cardContent = (
      <div
        className={cn(
          "relative flex flex-col items-center gap-1.5 p-3 rounded-xl group",
          "transition-all duration-200 hover:scale-105 hover:shadow-md cursor-pointer",
          color.bg,
          isFav && "ring-2 ring-yellow-400"
        )}
      >
        <page.icon className={cn("h-5 w-5", color.icon)} />
        <span className="text-[10px] font-medium text-center leading-tight text-foreground/80">
          {page.title}
        </span>
        <button
          onClick={(e) => handleToggleFavorite(page.route, e)}
          className={cn(
            "absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity",
            isFav && "opacity-100"
          )}
        >
          <Star
            className={cn(
              "h-3 w-3 transition-colors",
              isFav ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground hover:text-yellow-400"
            )}
          />
        </button>
      </div>
    );

    if (page.external) {
      return (
        <a
          href={page.route}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setIsOpen(false)}
        >
          {cardContent}
        </a>
      );
    }

    return (
      <Link to={page.route} onClick={() => setIsOpen(false)}>
        {cardContent}
      </Link>
    );
  };

  const CategorySection = ({ category, pages }: { category: string; pages: PageItem[] }) => {
    const color = categoryColors[category];
    const categoryInfo = categoryLabels[category];
    const CategoryIcon = categoryInfo.icon;

    return (
      <div className="p-3 border-b border-border/50 last:border-0">
        <h3 className={cn("text-xs font-semibold mb-2 flex items-center gap-1.5", color.text)}>
          <CategoryIcon className="h-3.5 w-3.5" />
          {categoryInfo.label}
        </h3>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
          {pages.map(page => (
            <MenuCard key={page.route} page={page} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 h-9">
          <Zap className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">Acesso Rápido</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[340px] sm:w-[480px] max-h-[70vh] overflow-hidden p-0"
        align="start"
        sideOffset={8}
      >
        {/* Search Header */}
        <div className="p-3 border-b border-border/50 sticky top-0 bg-popover z-10">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Buscar páginas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-16 h-9 text-sm"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              Ctrl+K
            </kbd>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(70vh-60px)]">
          {/* Favorites Section */}
          {favoritePages.length > 0 && !searchQuery && (
            <div className="p-3 border-b border-border/50 bg-yellow-500/5">
              <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5 text-yellow-600">
                <Star className="h-3.5 w-3.5 fill-current" />
                Favoritos
              </h3>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {favoritePages.map(page => (
                  <MenuCard key={`fav-${page.route}`} page={page} />
                ))}
              </div>
            </div>
          )}

          {/* Category Sections */}
          {categoryOrder.map(category => {
            const pages = groupedPages[category];
            if (!pages || pages.length === 0) return null;
            return <CategorySection key={category} category={category} pages={pages} />;
          })}

          {/* Empty State */}
          {filteredPages.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <SearchIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma página encontrada</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
