import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/client/ThemeToggle';
import { 
  User,
  Building2,
  MapPin,
  Image,
  Palette,
  Globe,
  CreditCard,
  LogOut,
  ChevronRight,
  Moon
} from 'lucide-react';

interface MobileAccountViewProps {
  blogName?: string;
}

const accountItems = [
  { 
    icon: Building2, 
    label: 'Minha Empresa', 
    path: '/client/company',
    description: 'Perfil do negócio'
  },
  { 
    icon: MapPin, 
    label: 'Territórios', 
    path: '/client/territories',
    description: 'Regiões de atuação'
  },
  { 
    icon: Globe, 
    label: 'Portal Público', 
    path: '/client/portal',
    description: 'Configurar blog'
  },
  { 
    icon: User, 
    label: 'Perfil', 
    path: '/client/account',
    description: 'Dados da conta'
  },
  { 
    icon: CreditCard, 
    label: 'Plano', 
    path: '/client/account',
    description: 'Gerenciar assinatura'
  },
];

export function MobileAccountView({ blogName }: MobileAccountViewProps) {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

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

  return (
    <div className="space-y-4 pb-24">
      {/* Header with user info */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-7 w-7 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground text-lg truncate">
              {blogName || 'Minha Conta'}
            </h2>
            <p className="text-sm text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Cards */}
      <div className="space-y-2">
        {accountItems.map((item) => {
          const Icon = item.icon;
          
          return (
            <button
              key={item.path + item.label}
              onClick={() => navigate(item.path)}
              className="w-full flex items-center justify-between p-4 bg-card rounded-xl border border-border active:bg-muted transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-muted">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </button>
          );
        })}
      </div>

      {/* Theme Toggle Card */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-lg bg-muted">
              <Moon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Tema</p>
              <p className="text-xs text-muted-foreground">Claro / Escuro</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Logout Button */}
      <Button
        variant="outline"
        onClick={handleSignOut}
        className="w-full h-12 gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
      >
        <LogOut className="h-5 w-5" />
        Sair da conta
      </Button>
    </div>
  );
}
