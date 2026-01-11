import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UseIsSubAccountResult {
  isSubAccount: boolean;
  loading: boolean;
}

/**
 * Hook to detect if the current user is a subaccount (client final)
 * Subaccounts have is_internal_account = true in their subscription
 */
export function useIsSubAccount(): UseIsSubAccountResult {
  const { user } = useAuth();
  const [isSubAccount, setIsSubAccount] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSubAccount = async () => {
      if (!user) {
        setIsSubAccount(false);
        setLoading(false);
        return;
      }

      try {
        // First get the user's blog
        const { data: blog, error: blogError } = await supabase
          .from('blogs')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (blogError || !blog) {
          setIsSubAccount(false);
          setLoading(false);
          return;
        }

        // Then check subscription for is_internal_account
        const { data: subscription, error: subError } = await supabase
          .from('subscriptions')
          .select('is_internal_account')
          .eq('blog_id', blog.id)
          .maybeSingle();

        if (subError) {
          console.error('[useIsSubAccount] Error checking subscription:', subError);
          setIsSubAccount(false);
        } else {
          setIsSubAccount(subscription?.is_internal_account === true);
        }
      } catch (err) {
        console.error('[useIsSubAccount] Error:', err);
        setIsSubAccount(false);
      }

      setLoading(false);
    };

    checkSubAccount();
  }, [user]);

  return { isSubAccount, loading };
}
