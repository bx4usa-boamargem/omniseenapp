import { ReactNode, useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBlog } from '@/hooks/useBlog';
import { useSubscription } from '@/hooks/useSubscription';
import { useIsSubAccount } from '@/hooks/useIsSubAccount';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UserGuardProps {
  children: ReactNode;
}

const LOADING_TIMEOUT_MS = 10000; // 10 seconds

export function UserGuard({ children }: UserGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { blog, loading: blogLoading, refetch: refetchBlog } = useBlog();
  const { isBlocked, loading: subscriptionLoading, refresh: refreshSubscription } = useSubscription();
  const { isSubAccount, loading: subAccountLoading } = useIsSubAccount();
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const isLoading = authLoading || blogLoading || subscriptionLoading || subAccountLoading;

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    
    if (isLoading) {
      timer = setTimeout(() => {
        setHasTimedOut(true);
      }, LOADING_TIMEOUT_MS);
    } else {
      setHasTimedOut(false);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading]);

  const handleRetry = async () => {
    setHasTimedOut(false);
    await Promise.all([refetchBlog(), refreshSubscription()]);
  };

  if (hasTimedOut) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-4 text-center">
        <p className="text-muted-foreground">O carregamento está demorando mais que o esperado.</p>
        <Button onClick={handleRetry} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Tentar novamente
        </Button>
        <Button variant="link" onClick={() => window.location.href = '/auth'}>
          Voltar ao login
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!blog) {
    return <Navigate to="/onboarding" replace />;
  }

  if (blog.onboarding_completed === false) {
    return <Navigate to="/onboarding" replace />;
  }

  // All authenticated users with completed onboarding use the modern /client/* experience
  // The legacy /app/* routes are now deprecated - redirect everyone to modern UI
  return <Navigate to="/client/dashboard" replace />;

  // Note: We no longer redirect to /blocked here.
  // The DashboardLayout will show a mandatory modal when isBlocked is true.
  // This allows users to stay on the dashboard and complete payment.

  return <>{children}</>;
}