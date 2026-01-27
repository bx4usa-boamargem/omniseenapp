import { ReactNode, useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { FloatingSupportChat } from '@/components/support/FloatingSupportChat';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { useMobileLayout } from '@/hooks/useMobileLayout';
import { MinimalSidebar } from '@/components/layout/MinimalSidebar';
import { AccountBlock } from '@/components/layout/AccountBlock';
import { ThemeToggle } from '@/components/client/ThemeToggle';

interface SubAccountLayoutProps {
  children: ReactNode;
}

const INTERNAL_ADMIN_EMAIL = 'omniseenblog@gmail.com';

export function SubAccountLayout({ children }: SubAccountLayoutProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isMobile } = useMobileLayout();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [isSupportChatOpen, setIsSupportChatOpen] = useState(false);
  const supportChatRef = useRef<{ open: () => void } | null>(null);

  const isInternalAccount = useMemo(() => {
    const email = user?.email?.toLowerCase();
    return email === INTERNAL_ADMIN_EMAIL;
  }, [user?.email]);

  // Check if user is platform admin to show Admin Panel link
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user?.id) return;

      const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', user.id);

      const hasAdminRole =
        roles?.some((r) => ['admin', 'platform_admin'].includes(r.role as string)) ?? false;

      setIsPlatformAdmin(hasAdminRole);
    };

    checkAdminRole();
  }, [user?.id]);

  const showAdvancedNav = isPlatformAdmin || isInternalAccount;

  const handleHelpClick = () => {
    // Trigger the floating support chat to open
    setIsSupportChatOpen(true);
  };

  return (
    <div className="min-h-screen client-bg flex">
      {/* Desktop Minimal Sidebar - visible on md (768px+) */}
      <aside className="hidden md:flex w-20 client-sidebar flex-col fixed h-full z-40 border-r border-border/50">
        <div className="flex flex-col h-full">
          {/* Top: Logo + Navigation Icons */}
          <div className="flex-1">
            <MinimalSidebar onHelpClick={handleHelpClick} />
          </div>
          
          {/* Admin Link - only for platform admins */}
          {isPlatformAdmin && (
            <div className="flex justify-center pb-2">
              <button
                onClick={() => navigate('/admin')}
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center',
                  'transition-all duration-200 cursor-pointer',
                  'text-muted-foreground hover:text-primary hover:bg-primary/10'
                )}
                title="Painel Admin"
              >
                <Shield className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Theme Toggle */}
          <div className="flex justify-center py-3 border-t border-border/50">
            <ThemeToggle />
          </div>

          {/* Account Block at bottom */}
          <div className="p-2 border-t border-border/50">
            <AccountBlock collapsed />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-20">
        <div className={cn('min-h-screen', isMobile ? 'pb-20' : '')}>
          <div className="p-4 md:p-8 max-w-5xl mx-auto">{children}</div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileBottomNav showAdvanced={showAdvancedNav} />}

      {/* Floating AI Support Chat - Hidden on mobile to avoid conflict with bottom nav */}
      {!isMobile && <FloatingSupportChat />}
    </div>
  );
}
