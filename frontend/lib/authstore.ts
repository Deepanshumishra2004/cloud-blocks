// src/store/authStore.ts
import { create } from "zustand";

export interface AuthUser {
  id:       string;
  email:    string;
  username: string;
  avatar?:  string | null;
  provider: "EMAIL" | "GOOGLE" | "GITHUB";
}

interface AuthStore {
  user:       AuthUser | null;
  token:      string | null;
  // isHydrated: prevents the app from showing a loading flash or
  // running a redirect before we've checked the cookie on mount.
  // Must be true before any protected route renders.
  isHydrated: boolean;

  setAuth:  (user: AuthUser, token: string | null) => void;
  logout:   () => void;
  hydrate:  (fetchUser: () => Promise<AuthUser | null>) => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user:       null,
  token:      null,
  isHydrated: false,

  // Called after successful email/password login OR OAuth callback
  setAuth: (user, token) => {
    set({ user, token });
  },

  // Called on sign-out — also sets isHydrated: true so the app
  // doesn't try to re-hydrate after an intentional logout
  logout: () => {
    set({ user: null, token: null, isHydrated: true });
  },

  // Called ONCE on app mount by AuthProvider.
  // Fetches /me using the backend cookie and populates the store.
  // On invalid/expired auth → clears store silently.
  hydrate: async (fetchUser) => {
    const user = await fetchUser();

    if (user) {
      set({ user, token: null, isHydrated: true });
    } else {
      set({ user: null, token: null, isHydrated: true });
    }
  },
}));
