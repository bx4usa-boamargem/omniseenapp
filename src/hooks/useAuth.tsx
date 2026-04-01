import React, { useState, useEffect, createContext, useContext, ReactNode, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initialSessionResolvedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const syncAuthState = (nextSession: Session | null) => {
      if (!isMounted) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    };

    const finalizeAuthState = (nextSession: Session | null) => {
      initialSessionResolvedRef.current = true;
      syncAuthState(nextSession);
      setLoading(false);
    };

    const failsafeTimer = setTimeout(() => {
      console.warn("[AuthProvider] Auth initialization exceeded 5 seconds, forcing unauthenticated state.");
      finalizeAuthState(null);
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION' && !initialSessionResolvedRef.current) {
        syncAuthState(nextSession);
        return;
      }

      clearTimeout(failsafeTimer);
      finalizeAuthState(nextSession);
    });

    const sessionTimeout = new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), 3000)
    );

    Promise.race([supabase.auth.getSession(), sessionTimeout])
      .then(({ data: { session: nextSession } }) => {
        clearTimeout(failsafeTimer);
        finalizeAuthState(nextSession);
      })
      .catch(() => {
        clearTimeout(failsafeTimer);
        finalizeAuthState(null);
      });

    return () => {
      isMounted = false;
      clearTimeout(failsafeTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SIGNOUT_TIMEOUT')), 3000)),
      ]);
    } catch (error) {
      console.warn('[AuthProvider] Sign out failed, clearing local auth state anyway.', error);
    } finally {
      initialSessionResolvedRef.current = true;
      setSession(null);
      setUser(null);
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    // Callback centralizado em app.omniseen.app para suporte a subdomínios
    // O return_to codifica a origem para redirecionamento final
    const returnTo = encodeURIComponent(window.location.origin + '/client/dashboard');
    const redirectTo = `https://app.omniseen.app/oauth/callback?return_to=${returnTo}`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    
    if (error) {
      console.error('Google OAuth error:', error);
      // Check for provider not enabled error
      if (error.message?.toLowerCase().includes('provider') || 
          error.message?.toLowerCase().includes('enabled') ||
          error.message?.toLowerCase().includes('not enabled')) {
        return { 
          error: new Error('Login com Google não está habilitado. Configure nas configurações do backend.') 
        };
      }
    }
    
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
