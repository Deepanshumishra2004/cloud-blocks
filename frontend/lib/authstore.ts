// src/store/authStore.ts
import { create } from "zustand";
import { tokenStorage } from "@/lib/api";

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

  setAuth:  (user: AuthUser, token: string) => void;
  logout:   () => void;
  hydrate:  (fetchUser: () => Promise<AuthUser | null>) => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user:       null,
  token:      null,
  isHydrated: false,

  // Called after successful email/password login OR OAuth callback
  setAuth: (user, token) => {
    tokenStorage.set(token);
    set({ user, token });
  },

  // Called on sign-out — also sets isHydrated: true so the app
  // doesn't try to re-hydrate after an intentional logout
  logout: () => {
    tokenStorage.clear();
    set({ user: null, token: null, isHydrated: true });
  },

  // Called ONCE on app mount by AuthProvider.
  // Reads the cookie → fetches /me → populates store.
  // On invalid/expired token → clears cookie silently.
  hydrate: async (fetchUser) => {
    const token = tokenStorage.get();

    if (!token) {
      // No cookie — nothing to restore
      set({ isHydrated: true });
      return;
    }

    set({ token }); // optimistically set token so api.ts interceptor sends it

    const user = await fetchUser();

    if (user) {
      set({ user, token, isHydrated: true });
    } else {
      // Token was expired or revoked — clear silently
      tokenStorage.clear();
      set({ user: null, token: null, isHydrated: true });
    }
  },
}));