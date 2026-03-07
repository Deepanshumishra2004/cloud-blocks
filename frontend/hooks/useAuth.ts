"use client";
// src/hooks/useAuth.ts

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authstore";
import api, { fetchUser } from "@/lib/api"; // single source of truth

// ── useAuth ───────────────────────────────────────────────────
// Call in any layout or page that needs the current user.
//
// Options:
//   required: true  →  redirect to  if not authenticated
//                       (use this in protected layouts, NOT individual pages)
export function useAuth({ required = false } = {}) {
  const { user, token, isHydrated, hydrate, logout } = useAuthStore();
  const router = useRouter();

  // If AuthProvider hasn't run yet (e.g. in a unit test or Storybook),
  // this hook will trigger hydration itself as a fallback.
  useEffect(() => {
    if (!isHydrated) hydrate(fetchUser);
  }, [isHydrated, hydrate]);

  // After hydration: redirect if page requires auth and user is absent
  useEffect(() => {
    if (isHydrated && required && !user) {
      router.replace("/signin");
    }
  }, [isHydrated, required, user, router]);

  const signout = useCallback(async () => {
    try {
      // Tell the backend to clear the HttpOnly cookie
      await api.post("/api/v1/user/signout");
    } catch {
      // Network error — clear locally regardless
    } finally {
      logout();
      router.replace("/signin");
    }
  }, [logout, router]);

  return {
    user,
    token,
    isHydrated,
    isAuthenticated: !!user,
    signout,
  };
}

// Convenience hook for protected pages / layouts
export function useRequireAuth() {
  return useAuth({ required: true });
}