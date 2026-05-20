import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Session, User, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthResult = { error: AuthError | null };

interface AuthContextType {
  loading: boolean;
  isLoggedIn: boolean;
  /** true wenn der User im lokalen Demo-Modus ist (LocalStorage statt Supabase). */
  isDemo: boolean;
  user: User | null;
  session: Session | null;
  userName: string;
  userEmail: string;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<AuthResult>;
  /**
   * Demo-Modus starten: setzt das Demo-Flag, lädt Beispieldaten in den
   * LocalStorage und macht einen vollständigen Seitenneuladen, damit die
   * Storage-Module neu mit dem LocalStorageAdapter initialisiert werden.
   */
  enterDemoMode: (name: string, email: string) => void;
  /** Legacy-Alias für alte Callsites — wird auf signOut gemappt. */
  logout: () => void;
  /** Legacy-Alias für alte Callsites — no-op außer Profil-Update. */
  login: (name: string, email: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  loading: true,
  isLoggedIn: false,
  isDemo: false,
  user: null,
  session: null,
  userName: '',
  userEmail: '',
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  resetPassword: async () => ({ error: null }),
  enterDemoMode: () => {},
  logout: () => {},
  login: () => {},
});

/**
 * Entfernt alle Immobilien-CRM-Daten aus localStorage (PII, Demo-Flag, Caches),
 * behält aber Spracheinstellung, Theme, Sidebar-State und Standard-Dashboard-Wahl,
 * weil das User-Präferenzen sind, die nichts mit Identität/Daten zu tun haben.
 */
function clearAllImmofreakLocalStorage(): void {
  const KEEP = new Set([
    'immofreak_locale',
    'immofreak_theme',
    'immofreak_sidebar',
    'immofreak_default_dashboard',
  ]);
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('immofreak_') && !KEEP.has(k)) {
        toRemove.push(k);
      }
      if (k.startsWith('supacache:')) toRemove.push(k);
    }
    for (const k of toRemove) localStorage.removeItem(k);
  } catch { /* ignore quota / sandbox errors */ }
}

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
  const [isDemo] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem('immofreak_demo') === 'true',
  );

  useEffect(() => {
    // Im Demo-Modus überspringen wir Supabase komplett.
    if (isDemo) {
      setLoading(false);
      return;
    }
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
  }, [isDemo]);

  // Sync der Profildaten in localStorage, damit Komponenten (Settings, Sidebar
  // Footer etc.), die direkt aus localStorage lesen, die echten User-Daten
  // sehen — nicht mehr den hartkodierten 'Yan / yan@immofreak.de'-Fallback.
  useEffect(() => {
    if (isDemo) return;
    if (!session) return;
    const u = session.user;
    const meta = (u.user_metadata ?? {}) as { full_name?: string; name?: string };
    const fullName = meta.full_name ?? meta.name ?? nameFromUser(u);
    const [first, ...rest] = fullName.split(' ');
    localStorage.setItem('immofreak_profile_name', fullName);
    localStorage.setItem('immofreak_profile_firstname', first ?? '');
    localStorage.setItem('immofreak_profile_lastname', rest.join(' '));
    if (u.email) localStorage.setItem('immofreak_profile_email', u.email);
  }, [session, isDemo]);

  // Inkonsistenz-Heilung: echte Supabase-Session vorhanden, aber alter
  // Demo-Flag noch in localStorage → Stores wurden als LocalStorageAdapter
  // initialisiert und zeigen Demo-Daten. Flag entfernen + Page-Reload, damit
  // storage.ts mit IS_DEMO=false neu lädt und SupabaseAdapter nutzt.
  //
  // Wichtig: Der Reload läuft NUR im allerersten Effect-Tick nach Mount —
  // sonst riskieren wir, optimistische Inserts mitten in der Mutation wegzuwerfen.
  // Damit der Refresh-Token-Cycle (~50min) nicht versehentlich einen Reload triggert,
  // markieren wir die Heilung als „erledigt" und führen sie nur einmal aus.
  const healedRef = useRef(false);
  useEffect(() => {
    if (healedRef.current) return;
    if (session && localStorage.getItem('immofreak_demo') === 'true') {
      healedRef.current = true;
      localStorage.removeItem('immofreak_demo');
      // Geschäftsdaten aus localStorage löschen (alte Demo-Reste)
      const KEEP_PREFIXES = ['immofreak_profile_', 'immofreak_ff_'];
      const KEEP_KEYS = new Set([
        'immofreak_locale',
        'immofreak_mode',
        'immofreak_landlord_settings',
        'immofreak_default_dashboard',
        'immofreak_sidebar',
        'immofreak_theme',
      ]);
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (!key.startsWith('immofreak_')) continue;
        if (KEEP_KEYS.has(key)) continue;
        if (KEEP_PREFIXES.some((p) => key.startsWith(p))) continue;
        toRemove.push(key);
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
      window.location.reload();
    }
  }, [session]);

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
    if (isDemo) {
      // Demo-Logout: Flag entfernen + Reload, damit Stores wieder mit Supabase laufen.
      clearAllImmofreakLocalStorage();
      window.location.href = '/login';
      return;
    }
    await supabase.auth.signOut();
    // Beim echten Logout PII (Profil-Daten) und Vermieter-Einstellungen entfernen,
    // damit auf Shared-Devices keine Reste für den nächsten User sichtbar bleiben.
    clearAllImmofreakLocalStorage();
  }, [isDemo]);

  const resetPassword = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  }, []);

  const enterDemoMode = useCallback((name: string, email: string) => {
    localStorage.setItem('immofreak_demo', 'true');
    localStorage.setItem('immofreak_profile_name', name);
    localStorage.setItem('immofreak_profile_email', email);
    // Reload erzwingen, damit storage.ts den IS_DEMO-Flag liest und
    // die Stores als LocalStorageAdapter initialisiert werden.
    window.location.href = '/';
  }, []);

  const user = session?.user ?? null;
  const demoName = typeof window !== 'undefined' ? localStorage.getItem('immofreak_profile_name') ?? '' : '';
  const demoEmail = typeof window !== 'undefined' ? localStorage.getItem('immofreak_profile_email') ?? '' : '';

  const value: AuthContextType = {
    loading,
    isLoggedIn: !!session || isDemo,
    isDemo,
    user,
    session,
    userName: isDemo ? demoName : nameFromUser(user),
    userEmail: isDemo ? demoEmail : user?.email ?? '',
    signIn,
    signUp,
    signOut,
    resetPassword,
    enterDemoMode,
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
