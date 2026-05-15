import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthResult = { error: AuthError | null };

interface AuthContextType {
  loading: boolean;
  isLoggedIn: boolean;
  user: User | null;
  session: Session | null;
  userName: string;
  userEmail: string;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  /** Legacy-Alias für alte Callsites — wird auf signOut gemappt. */
  logout: () => void;
  /** Legacy-Alias für alte Callsites — no-op außer Profil-Update. */
  login: (name: string, email: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  loading: true,
  isLoggedIn: false,
  user: null,
  session: null,
  userName: '',
  userEmail: '',
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  resetPassword: async () => ({ error: null }),
  logout: () => {},
  login: () => {},
});

function nameFromUser(u: User | null): string {
  if (!u) return '';
  const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
  if (meta.full_name) return meta.full_name;
  if (meta.name) return meta.name;
  if (u.email) {
    return u.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return '';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      return { error };
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  }, []);

  const user = session?.user ?? null;
  const value: AuthContextType = {
    loading,
    isLoggedIn: !!session,
    user,
    session,
    userName: nameFromUser(user),
    userEmail: user?.email ?? '',
    signIn,
    signUp,
    signOut,
    resetPassword,
    logout: () => {
      void signOut();
    },
    login: () => {
      // Legacy-API — modernes Login läuft über signIn(). No-op behalten,
      // damit alte Callsites (z. B. die alte LoginPage) nichts kaputtmachen.
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
