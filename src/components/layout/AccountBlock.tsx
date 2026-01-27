import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Link2, 
  CreditCard, 
  BarChart3, 
  Bell,
  LogOut,
  ChevronUp,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/hooks/useAuth';
import { useBlog } from '@/hooks/useBlog';

interface AccountMenuItem {
  icon: React.ElementType;
  label: string;
  sublabel?: string;
  action: () => void;
  divider?: boolean;
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
  const [isOpen, setIsOpen] = useState(false);

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
    setIsOpen(false);
  };

  const menuItems: AccountMenuItem[] = [
    {
      icon: User,
      label: 'Configurações de perfil',
      action: () => navigateTo('/client/settings?tab=profile'),
    },
    {
      icon: Link2,
      label: 'Integrações',
      action: () => navigateTo('/client/settings?tab=integrations'),
    },
    {
      icon: CreditCard,
      label: 'Cobrança',
      action: () => navigateTo('/client/settings?tab=billing'),
    },
    {
      icon: BarChart3,
      label: 'Uso',
      action: () => navigateTo('/client/settings?tab=usage'),
    },
    {
      icon: Bell,
      label: 'Notificações',
      action: () => navigateTo('/client/settings?tab=notifications'),
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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'account-block w-full p-3 rounded-xl cursor-pointer',
            'transition-all duration-200 hover:bg-primary/5',
            'flex items-center gap-3 text-left',
            'focus:outline-none focus:ring-2 focus:ring-primary/50'
          )}
        >
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarImage src={blog?.logo_url || undefined} alt={blogName} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
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
          
          {!collapsed && (
            <ChevronUp className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180'
            )} />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent 
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
                  item.highlight && 'bg-primary/5 hover:bg-primary/10',
                  item.destructive && 'text-destructive hover:bg-destructive/10'
                )}
              >
                <Icon className={cn(
                  'h-4 w-4',
                  item.highlight && 'text-primary',
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
            'bg-gradient-to-r from-primary/10 to-purple-500/10',
            'hover:from-primary/20 hover:to-purple-500/20'
          )}
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <div className="flex-1">
            <span className="text-sm font-medium text-primary">Desbloqueie recursos!</span>
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
      </PopoverContent>
    </Popover>
  );
}
