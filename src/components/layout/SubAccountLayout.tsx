import { ReactNode, useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { FloatingSupportChat } from '@/components/support/FloatingSupportChat';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';
import { useMobileLayout } from '@/hooks/useMobileLayout';
import { PremiumSidebar } from '@/components/layout/PremiumSidebar';

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
      {/* Premium Sidebar - Desktop (lg: 1024px+) - Largura fixa 280px */}
      <PremiumSidebar 
        isPlatformAdmin={isPlatformAdmin}
        onHelpClick={handleHelpClick}
      />

      {/* Main Content - Margin fixo para sidebar de 280px */}
      <main className="flex-1 lg:ml-[280px]">
        <div className={cn('min-h-screen', isMobile ? 'pb-20' : '')}>
          <div className="p-4 md:p-8 max-w-5xl mx-auto">{children}</div>
        </div>
      </main>

      {/* Mobile Bottom Navigation - Apenas para mobile */}
      {isMobile && <MobileBottomNav showAdvanced={showAdvancedNav} />}

      {/* Floating AI Support Chat - Hidden on mobile to avoid conflict with bottom nav */}
      {!isMobile && <FloatingSupportChat />}
    </div>
  );
}
