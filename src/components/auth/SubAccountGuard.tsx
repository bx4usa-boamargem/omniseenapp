import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBlog } from '@/hooks/useBlog';
import { useIsSubAccount } from '@/hooks/useIsSubAccount';
import { Loader2 } from 'lucide-react';

interface SubAccountGuardProps {
  children: ReactNode;
}

/**
 * Guard for subaccount routes (/client/*)
 * - Redirects non-authenticated users to /auth
 * - Redirects non-subaccounts to /app/dashboard
 * - Allows subaccounts to access client routes
 */
export function SubAccountGuard({ children }: SubAccountGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { blog, loading: blogLoading } = useBlog();
  const { isSubAccount, loading: subAccountLoading } = useIsSubAccount();

  const isLoading = authLoading || blogLoading || subAccountLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // No blog yet - go to onboarding
  if (!blog) {
    return <Navigate to="/onboarding" replace />;
  }

  // Note: We now allow ALL authenticated users with a blog to access /client/*
  // The isSubAccount check has been removed to enable unified modern experience
  // Platform admins can still access /admin/* via PlatformAdminGuard

  return <>{children}</>;
}
