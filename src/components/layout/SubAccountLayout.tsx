import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Globe, 
  Zap, 
  Building2, 
  User, 
  Menu, 
  LogOut, 
  Compass, 
  TrendingUp,
  FileText,
  Activity,
  Shield,
  MapPin,
  HelpCircle,
  Users,
  BookOpen
} from 'lucide-react';
import { FloatingSupportChat } from '@/components/support/FloatingSupportChat';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OmniseenLogo } from '@/components/ui/OmniseenLogo';
import { useAuth } from '@/hooks/useAuth';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/client/ThemeToggle';
import { supabase } from '@/integrations/supabase/client';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { useMobileLayout } from '@/hooks/useMobileLayout';

interface SubAccountLayoutProps {
  children: ReactNode;
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

// Nova estrutura organizada em blocos semânticos
const navSections: NavSection[] = [
  {
    label: 'RESULTADOS',
    items: [
      { icon: TrendingUp, label: 'Resultados & ROI', path: '/client/results' },
      { icon: Users, label: 'Leads Capturados', path: '/client/leads' },
    ]
  },
  {
    label: 'INTELIGÊNCIA',
    items: [
      { icon: Compass, label: 'Radar de Oportunidades', path: '/client/radar' },
      { icon: Activity, label: 'Análise de SEO', path: '/client/seo' },
    ]
  },
  {
    label: 'CONTEÚDO',
    items: [
      { icon: FileText, label: 'Artigos', path: '/client/articles' },
      { icon: Globe, label: 'Portal Público', path: '/client/portal' },
      // eBooks item will be added dynamically for admins only
    ]
  },
  {
    label: 'OPERAÇÃO',
    items: [
      { icon: Zap, label: 'Automação', path: '/client/automation' },
      { icon: MapPin, label: 'Territórios', path: '/client/territories' },
      { icon: User, label: 'Perfil', path: '/client/profile' },
      { icon: Globe, label: 'Domínios', path: '/client/domains' },
      { icon: HelpCircle, label: 'Ajuda', path: '/client/help' },
    ]
  },
];

export function SubAccountLayout({ children }: SubAccountLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();
  const { isMobile } = useMobileLayout();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  // Check if user is platform admin to show Admin Panel link
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user?.id) return;
      
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      
      const hasAdminRole = roles?.some(r => 
        ['admin', 'platform_admin'].includes(r.role as string)
      ) ?? false;
      
      setIsPlatformAdmin(hasAdminRole);
    };
    
    checkAdminRole();
  }, [user?.id]);

  const isActive = (path: string) => location.pathname === path;

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      // Force navigation after sign out
      window.location.href = '/auth';
    } catch (error) {
      console.error('Error signing out:', error);
      // Force navigation even on error
      window.location.href = '/auth';
    }
  };

  const NavButton = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    
    return (
      <button
        onClick={() => handleNavigation(item.path)}
        className={cn(
          "client-nav-item w-full flex items-center gap-4 text-left",
          active 
            ? "active text-gray-900 dark:text-white font-medium" 
            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
        )}
      >
        <Icon className={cn(
          "h-5 w-5 shrink-0 transition-colors",
          active ? "text-violet-600 dark:text-orange-400" : "text-gray-400 dark:text-gray-500"
        )} />
        <span className="text-sm">{item.label}</span>
      </button>
    );
  };

  const SectionLabel = ({ label }: { label: string }) => (
    <div className="px-4 pt-4 pb-2">
      <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">
        {label}
      </span>
    </div>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-white/10">
        <OmniseenLogo size="lg" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Dashboard - sempre primeiro */}
        <div className="p-4 pb-0" data-tour="dashboard-menu">
          <NavButton item={{ icon: LayoutDashboard, label: 'Dashboard', path: '/client/dashboard' }} />
        </div>

        {/* Seções organizadas - with data-tour for guided tour */}
        {navSections.map((section) => {
          // Build items list, adding eBooks for admins in CONTEÚDO section
          let items = section.items;
          if (section.label === 'CONTEÚDO' && isPlatformAdmin) {
            items = [
              ...section.items,
              { icon: BookOpen, label: 'eBooks', path: '/client/ebooks' }
            ];
          }
          
          return (
            <div key={section.label}>
              <SectionLabel label={section.label} />
              <div className="px-4 space-y-1">
                {items.map((item) => {
                  // Add data-tour attributes for specific menu items
                  const tourId = item.path === '/client/radar' ? 'radar-menu' 
                    : item.path === '/client/articles' ? 'articles-menu'
                    : item.path === '/client/automation' ? 'automation-menu'
                    : item.path === '/client/profile' ? 'company-menu'
                    : undefined;
                  
                  return (
                    <div key={item.path} data-tour={tourId}>
                      <NavButton item={item} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Admin Panel - only visible for platform admins */}
        {isPlatformAdmin && (
          <div>
            <SectionLabel label="ADMINISTRAÇÃO" />
            <div className="px-4 space-y-1">
              <NavButton item={{ icon: Shield, label: 'Painel Admin', path: '/admin' }} />
            </div>
          </div>
        )}
      </nav>

      {/* Theme Toggle */}
      <div className="px-4 py-2 border-t border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Tema</span>
          <ThemeToggle />
        </div>
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-slate-200 dark:border-white/10">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="text-sm">Sair</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen client-bg flex">
      {/* Desktop Sidebar - visible on md (768px+) */}
      <aside className="hidden md:flex w-64 client-sidebar flex-col fixed h-full z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Header - Hidden on mobile, we use bottom nav instead */}
      {/* Only show header on tablet/desktop when sidebar is visible */}
      
      {/* Main Content */}
      <main className="flex-1 md:ml-64">
        <div className={cn(
          "min-h-screen",
          isMobile ? "pb-20" : "" // Add padding for bottom nav on mobile
        )}>
          <div className="p-4 md:p-8 max-w-5xl mx-auto">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav />}

      {/* Floating AI Support Chat - Hidden on mobile to avoid conflict with bottom nav */}
      {!isMobile && <FloatingSupportChat />}
    </div>
  );
}