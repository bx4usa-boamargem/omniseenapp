import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Building2,
  Compass,
  CreditCard, 
  LogOut,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { useAuth } from '@/hooks/useAuth';
import { useBlog } from '@/hooks/useBlog';

interface AccountMenuItem {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  action: () => void;
  highlight?: boolean;
  destructive?: boolean;
}

interface AccountBlockProps {
  collapsed?: boolean;
}

export function AccountBlock({ collapsed }: AccountBlockProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { blog } = useBlog();

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Error signing out:', error);
      window.location.href = '/login';
    }
  };

  const navigateTo = (path: string) => {
    navigate(path);
  };

  const menuItems: AccountMenuItem[] = [
    {
      icon: User,
      label: 'Minha Conta',
      action: () => navigateTo('/client/account'),
    },
    {
      icon: Building2,
      label: 'Minha Empresa',
      action: () => navigateTo('/client/company'),
    },
    {
      icon: Compass,
      label: 'Estratégia',
      action: () => navigateTo('/client/radar'),
    },
    {
      icon: CreditCard,
      label: 'Plano & Cobrança',
      action: () => navigateTo('/client/settings?tab=billing'),
    },
  ];

  const blogName = blog?.name || 'Meu Blog';
  const userEmail = user?.email || '';
  const initials = blogName
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <HoverCard openDelay={100} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          onClick={() => navigate('/client/account')}
          className={cn(
            'account-block w-full p-2 rounded-xl cursor-pointer',
            'transition-all duration-200 hover:bg-orange-500/5',
            'flex items-center gap-2 text-left',
            'focus:outline-none focus:ring-2 focus:ring-orange-500/50'
          )}
        >
          <Avatar className="h-8 w-8 border-2 border-orange-500/20">
            <AvatarImage src={blog?.logo_url || undefined} alt={blogName} />
            <AvatarFallback className="bg-orange-500/10 text-orange-600 font-semibold text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {blogName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {userEmail}
              </p>
            </div>
          )}
        </button>
      </HoverCardTrigger>

      <HoverCardContent 
        side="top" 
        align="start" 
        className="w-64 p-2"
        sideOffset={8}
      >
        {/* Menu Items */}
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.action}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left',
                  'transition-all duration-150',
                  'text-foreground hover:bg-muted',
                  item.highlight && 'bg-orange-500/5 hover:bg-orange-500/10',
                  item.destructive && 'text-destructive hover:bg-destructive/10'
                )}
              >
                <Icon className={cn(
                  'h-4 w-4',
                  item.highlight && 'text-orange-500',
                  item.destructive && 'text-destructive'
                )} />
                <div className="flex-1">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.sublabel && (
                    <p className="text-xs text-muted-foreground">{item.sublabel}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="my-2 h-px bg-border" />

        {/* Upgrade CTA */}
        <button
          onClick={() => navigateTo('/client/settings?tab=billing')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left',
            'transition-all duration-150',
            'bg-gradient-to-r from-orange-500/10 to-amber-500/10',
            'hover:from-orange-500/20 hover:to-amber-500/20'
          )}
        >
          <Sparkles className="h-4 w-4 text-orange-500" />
          <div className="flex-1">
            <span className="text-sm font-medium text-orange-600 dark:text-orange-400">Desbloqueie recursos!</span>
            <p className="text-xs text-muted-foreground">Mais potência, melhor SEO</p>
          </div>
        </button>

        {/* Divider */}
        <div className="my-2 h-px bg-border" />

        {/* Sign Out */}
        <button
          onClick={handleSignOut}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left',
            'transition-all duration-150',
            'text-destructive hover:bg-destructive/10'
          )}
        >
          <LogOut className="h-4 w-4" />
          <span className="text-sm font-medium">Sair</span>
        </button>
      </HoverCardContent>
    </HoverCard>
  );
}
