import { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, PenSquare, Globe, Zap, Building2, User, Menu, X, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { OmniseenLogo } from '@/components/ui/OmniseenLogo';
import { useAuth } from '@/hooks/useAuth';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface SubAccountLayoutProps {
  children: ReactNode;
}

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Início', path: '/client/dashboard' },
  { icon: PenSquare, label: 'Criar Artigo', path: '/client/create' },
  { icon: Globe, label: 'Meu Mini-Site', path: '/client/site' },
  { icon: Zap, label: 'Automação', path: '/client/automation' },
  { icon: Building2, label: 'Minha Empresa', path: '/client/company' },
  { icon: User, label: 'Minha Conta', path: '/client/account' },
];

export function SubAccountLayout({ children }: SubAccountLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const NavButton = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    
    return (
      <button
        onClick={() => handleNavigation(item.path)}
        className={cn(
          "w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-all duration-200",
          "hover:bg-primary/10",
          active 
            ? "bg-primary/15 text-primary font-medium shadow-sm" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Icon className={cn("h-6 w-6 shrink-0", active && "text-primary")} />
        <span className="text-base">{item.label}</span>
      </button>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b">
        <OmniseenLogo size="lg" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavButton key={item.path} item={item} />
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
        >
          <LogOut className="h-6 w-6 shrink-0" />
          <span className="text-base">Sair</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 border-r bg-card flex-col fixed h-full">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b z-50 flex items-center justify-between px-4">
        <OmniseenLogo size="md" />
        
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-72">
        <div className="pt-16 lg:pt-0 min-h-screen">
          <div className="p-4 lg:p-8 max-w-5xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
