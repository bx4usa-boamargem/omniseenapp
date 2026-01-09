import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useBlog } from "@/hooks/useBlog";
import { useFavoritePages } from "@/hooks/useFavoritePages";
import { useConfetti } from "@/hooks/useConfetti";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Star, ExternalLink, Lock, ArrowRight, Sparkles,
  LayoutDashboard, FileText, PenLine, BookOpen, Calendar,
  Target, Key, Layers, BarChart3, TrendingUp,
  Zap, Settings, User, CreditCard, HelpCircle,
  Shield, CheckSquare, Globe, DollarSign, UserPlus, Users2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface PageItem {
  title: string;
  route: string;
  icon: React.ReactNode;
  description: string;
  category: string;
  external?: boolean;
  adminOnly?: boolean;
  featured?: boolean;
}

const categoryConfig: Record<string, { label: string; color: string; order: number }> = {
  content: { label: "📝 Conteúdo", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", order: 1 },
  strategy: { label: "🎯 Estratégia", color: "bg-purple-500/10 text-purple-600 border-purple-500/20", order: 2 },
  analysis: { label: "📊 Análise", color: "bg-green-500/10 text-green-600 border-green-500/20", order: 3 },
  management: { label: "⚙️ Gestão", color: "bg-orange-500/10 text-orange-600 border-orange-500/20", order: 4 },
  external: { label: "🌐 Externo", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20", order: 5 },
  admin: { label: "🛡️ Admin", color: "bg-red-500/10 text-red-600 border-red-500/20", order: 6 },
};

export default function QuickAccess() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { blog, loading: blogLoading } = useBlog();
  const { favorites, toggleFavorite } = useFavoritePages();
  const { fireConfetti } = useConfetti();
  const [searchQuery, setSearchQuery] = useState("");
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      const adminRoles = ['admin', 'platform_admin'];
      const hasAdminRole = roles?.some(r => adminRoles.includes(r.role as string)) ?? false;
      setIsPlatformAdmin(hasAdminRole);
    };
    checkAdmin();
  }, [user]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("quick-access-search")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const pages: PageItem[] = useMemo(() => [
    // Content
    { title: "Início", route: "/app/dashboard", icon: <LayoutDashboard className="h-5 w-5" />, description: "Painel principal com visão geral", category: "content" },
    { title: "Conteúdos", route: "/app/articles", icon: <FileText className="h-5 w-5" />, description: "Gerenciar todos os artigos", category: "content" },
    { title: "Novo Artigo", route: "/app/articles/new", icon: <PenLine className="h-5 w-5" />, description: "Criar artigo com IA", category: "content" },
    { title: "Artigo via Chat", route: "/app/articles/new-chat", icon: <PenLine className="h-5 w-5" />, description: "Criar artigo conversando com IA", category: "content" },
    { title: "Ebooks", route: "/app/ebooks", icon: <BookOpen className="h-5 w-5" />, description: "Transformar artigos em ebooks", category: "content" },
    { title: "Calendário", route: "/app/calendar", icon: <Calendar className="h-5 w-5" />, description: "Calendário editorial", category: "content" },
    
    // Strategy
    { title: "Estratégia", route: "/app/strategy", icon: <Target className="h-5 w-5" />, description: "Configurar nicho e personas", category: "strategy" },
    { title: "Palavras-chave", route: "/app/keywords", icon: <Key className="h-5 w-5" />, description: "Análise de keywords", category: "strategy" },
    { title: "Clusters", route: "/app/clusters", icon: <Layers className="h-5 w-5" />, description: "Grupos de conteúdo relacionado", category: "strategy" },
    
    // Analysis
    { title: "Desempenho", route: "/app/performance", icon: <BarChart3 className="h-5 w-5" />, description: "Análise SEO e performance", category: "analysis" },
    { title: "Analytics", route: "/app/analytics", icon: <TrendingUp className="h-5 w-5" />, description: "Métricas de tráfego", category: "analysis" },
    
    // Management
    { title: "Automações", route: "/app/automation", icon: <Zap className="h-5 w-5" />, description: "Configurar automação de posts", category: "management" },
    { title: "Meu Blog", route: "/app/my-blog", icon: <Globe className="h-5 w-5" />, description: "Personalizar visual e domínio", category: "management" },
    { title: "Configurações", route: "/app/settings", icon: <Settings className="h-5 w-5" />, description: "Preferências do sistema", category: "management" },
    { title: "Conta", route: "/app/account", icon: <User className="h-5 w-5" />, description: "Gerenciar equipe", category: "management" },
    { title: "Perfil", route: "/app/profile", icon: <User className="h-5 w-5" />, description: "Seu perfil de autor", category: "management" },
    { title: "Assinatura", route: "/app/subscription", icon: <CreditCard className="h-5 w-5" />, description: "Gerenciar plano", category: "management" },
    { title: "Central de Ajuda", route: "/help", icon: <HelpCircle className="h-5 w-5" />, description: "Tutoriais e suporte", category: "management" },
    
    // External
    { title: "Landing Page", route: "/", icon: <Globe className="h-5 w-5" />, description: "Página de vendas do produto", category: "external", external: true, featured: true },
    { title: "Ver Meu Blog", route: blog ? `/blog/${blog.slug}` : "#", icon: <ExternalLink className="h-5 w-5" />, description: "Visualizar blog público", category: "external", external: true },
    { title: "Pricing", route: "/pricing", icon: <DollarSign className="h-5 w-5" />, description: "Tabela de preços", category: "external", external: true },
    
    // Admin
    { title: "Criar Subconta", route: "/admin?tab=customer-accounts", icon: <UserPlus className="h-5 w-5" />, description: "Criar cliente manualmente sem Stripe", category: "admin", adminOnly: true },
    { title: "Equipe Interna", route: "/admin?tab=internal-staff", icon: <Users2 className="h-5 w-5" />, description: "Gerenciar staff da plataforma", category: "admin", adminOnly: true },
    { title: "Painel Admin", route: "/admin", icon: <Shield className="h-5 w-5" />, description: "Administração completa da plataforma", category: "admin", adminOnly: true },
    { title: "Validação", route: "/admin/validation", icon: <CheckSquare className="h-5 w-5" />, description: "Dashboard de validação", category: "admin", adminOnly: true },
  ], [blog]);

  const filteredPages = useMemo(() => {
    let result = pages.filter(p => !p.adminOnly || isPlatformAdmin);
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [pages, searchQuery, isPlatformAdmin]);

  const favoritePages = useMemo(() => 
    filteredPages.filter(p => favorites.includes(p.route)),
    [filteredPages, favorites]
  );

  const groupedPages = useMemo(() => {
    const groups: Record<string, PageItem[]> = {};
    filteredPages.forEach(page => {
      if (!groups[page.category]) groups[page.category] = [];
      groups[page.category].push(page);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => (categoryConfig[a]?.order || 99) - (categoryConfig[b]?.order || 99));
  }, [filteredPages]);

  const handleNavigate = (page: PageItem) => {
    if (page.external) {
      window.open(page.route, "_blank");
    } else {
      navigate(page.route);
    }
  };

  const handleToggleFavorite = (route: string) => {
    toggleFavorite(route);
    if (!favorites.includes(route)) {
      fireConfetti();
    }
  };

  const isAuthenticated = !!user;
  const publicRoutes = ['/', '/pricing', '/auth'];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Public version for non-authenticated users
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-50 glass">
          <div className="container flex h-16 items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <div className="p-2 rounded-lg gradient-primary">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-display font-bold text-xl">OMNISEEN</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link to="/auth">
                <Button variant="ghost">Entrar</Button>
              </Link>
              <Link to="/auth">
                <Button>
                  Começar Grátis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <div className="pt-24 pb-12 px-4">
          <div className="container max-w-6xl">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Mapa do Sistema</h1>
              <p className="text-muted-foreground">
                Explore todas as funcionalidades do OMNISEEN
              </p>
            </div>

            {/* Search */}
            <div className="relative max-w-md mx-auto mb-8">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar funcionalidades..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-8">
              {groupedPages.map(([category, categoryPages]) => (
                <div key={category} className="space-y-3">
                  <h2 className="text-lg font-semibold">
                    {categoryConfig[category]?.label || category}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {categoryPages.map((page) => {
                      const isPublic = publicRoutes.includes(page.route) || page.external;
                      const isFeatured = page.featured;
                      return (
                        <Card
                          key={page.route}
                          className={`transition-all ${
                            isFeatured
                              ? 'col-span-full sm:col-span-2 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 border-2 border-purple-500/30 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 cursor-pointer'
                              : isPublic 
                                ? 'cursor-pointer hover:shadow-md hover:border-primary/50' 
                                : 'opacity-70'
                          }`}
                          onClick={() => isPublic && handleNavigate(page)}
                        >
                          <CardContent className={isFeatured ? 'p-6' : 'p-4'}>
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${
                                isFeatured
                                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                  : categoryConfig[category]?.color || 'bg-muted'
                              }`}>
                                {page.icon}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className={`font-medium truncate ${isFeatured ? 'text-lg' : ''}`}>
                                    {page.title}
                                  </h3>
                                  {isFeatured && (
                                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                                      Destaque
                                    </Badge>
                                  )}
                                  {!isPublic && !isFeatured && (
                                    <Lock className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  )}
                                  {page.external && !isFeatured && (
                                    <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  )}
                                </div>
                                <p className={`text-muted-foreground ${isFeatured ? 'text-sm' : 'text-xs line-clamp-1'}`}>
                                  {page.description}
                                </p>
                                {!isPublic && !isFeatured && (
                                  <Badge variant="outline" className="mt-2 text-xs">
                                    Requer login
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-12 text-center">
              <div className="inline-flex flex-col items-center gap-4 p-8 rounded-2xl bg-primary/5 border border-primary/20">
                <h3 className="text-xl font-semibold">Quer acessar todas as funcionalidades?</h3>
                <p className="text-muted-foreground">Crie sua conta grátis e comece a usar agora</p>
                <Link to="/auth">
                  <Button size="lg">
                    Criar Conta Grátis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-bold">Acesso Fácil</h1>
            <p className="text-muted-foreground">
              Todas as páginas do sistema em um único lugar
            </p>
          </div>
          
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="quick-access-search"
              placeholder="Buscar páginas... (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-8">
            {/* Favorites Section */}
            {favoritePages.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  Favoritos
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {favoritePages.map((page) => (
                    <Card
                      key={page.route}
                      className="cursor-pointer hover:shadow-md transition-all hover:border-primary/50 group"
                      onClick={() => handleNavigate(page)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                              {page.icon}
                            </div>
                            <div>
                              <h3 className="font-medium group-hover:text-primary transition-colors">
                                {page.title}
                              </h3>
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {page.description}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(page.route);
                            }}
                          >
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Category Sections */}
            {groupedPages.map(([category, categoryPages]) => (
              <div key={category} className="space-y-3">
                <h2 className="text-lg font-semibold">
                  {categoryConfig[category]?.label || category}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {categoryPages.map((page) => {
                    const isFavorite = favorites.includes(page.route);
                    const isFeatured = page.featured;
                    return (
                      <Card
                        key={page.route}
                        className={`cursor-pointer transition-all group ${
                          isFeatured
                            ? 'col-span-full sm:col-span-2 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 border-2 border-purple-500/30 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10'
                            : 'hover:shadow-md hover:border-primary/50'
                        }`}
                        onClick={() => handleNavigate(page)}
                      >
                        <CardContent className={isFeatured ? 'p-6' : 'p-4'}>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${
                                isFeatured
                                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                                  : categoryConfig[category]?.color || 'bg-muted'
                              }`}>
                                {page.icon}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className={`font-medium group-hover:text-primary transition-colors truncate ${isFeatured ? 'text-lg' : ''}`}>
                                    {page.title}
                                  </h3>
                                  {isFeatured && (
                                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                                      Destaque
                                    </Badge>
                                  )}
                                  {page.external && !isFeatured && (
                                    <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                  )}
                                </div>
                                <p className={`text-muted-foreground ${isFeatured ? 'text-sm' : 'text-xs line-clamp-1'}`}>
                                  {page.description}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-8 w-8 flex-shrink-0 ${isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleFavorite(page.route);
                              }}
                            >
                              <Star className={`h-4 w-4 ${isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`} />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredPages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma página encontrada para "{searchQuery}"</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </DashboardLayout>
  );
}
