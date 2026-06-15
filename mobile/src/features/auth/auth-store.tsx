// App-wide authentication state. Hydrates from the stored token on launch,
// exposes sign-in / sign-up / sign-out, and redirects to /signin when the
// session becomes invalid.
import { router } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { api, onUnauthorized } from '@/lib/api';
import { tokenStore } from '@/lib/token-store';
import type { User } from '@/features/app/app-types';

type AuthState = {
  user: User | null;
  loading: boolean; // true while bootstrapping from stored token
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap: if we have a stored token, fetch the profile.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await tokenStore.getAccess();
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const me = await api.me();
        if (!cancelled) setUser(me);
      } catch {
        await tokenStore.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Global 401 handler → drop session + bounce to sign-in.
  useEffect(() => {
    return onUnauthorized(() => {
      setUser(null);
      router.replace('/signin');
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setUser(await api.signin(email, password));
  }, []);

  const signUp = useCallback(async (email: string, username: string, password: string) => {
    setUser(await api.signup(email, username, password));
  }, []);

  const signOut = useCallback(async () => {
    await api.signout();
    setUser(null);
    router.replace('/signin');
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signUp, signOut }),
    [user, loading, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
