import { create } from "zustand";

export interface AuthUser {
  id:       string;
  email:    string;
  username: string;
  avatar?:  string | null;
  provider: "EMAIL" | "GOOGLE" | "GITHUB";
}

interface AuthStore {
  user:        AuthUser | null;
  token:       string | null;
  isHydrated:  boolean;
  setAuth:  (user: AuthUser, token: string | null) => void;
  logout:   () => void;
  hydrate:  (fetchUser: () => Promise<AuthUser | null>) => Promise<void>;
}

// Module-level singleton: if multiple hook instances call hydrate() at the
// same time (AuthProvider + layout + page all mount simultaneously), they all
// await the same in-flight network request instead of firing N copies.
let _hydrating: Promise<void> | null = null;

export const useAuthStore = create<AuthStore>((set, get) => ({
  user:       null,
  token:      null,
  isHydrated: false,

  setAuth: (user, token) => set({ user, token, isHydrated: true }),

  logout: () => set({ user: null, token: null, isHydrated: true }),

  hydrate: (fetchUser) => {
    // Already done — no-op.
    if (get().isHydrated) return Promise.resolve();

    // In flight — reuse the existing promise so we never fire two /me requests.
    if (_hydrating) return _hydrating;

    _hydrating = fetchUser()
      .then((user) => set({ user: user ?? null, token: null, isHydrated: true }))
      .catch(() => set({ user: null, token: null, isHydrated: true }))
      .finally(() => { _hydrating = null; });

    return _hydrating;
  },
}));
