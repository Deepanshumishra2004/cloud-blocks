"use client";
// src/components/auth/AuthProvider.tsx
//
// Place this in src/app/layout.tsx wrapping the entire tree.
// It runs hydrate() exactly once on first mount.
// All pages then read from the Zustand store — no prop drilling needed.

import { useEffect } from "react";
import { useAuthStore } from "@/lib/authstore";
import { fetchUser } from "@/lib/api"; // single source of truth

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isHydrated, hydrate } = useAuthStore();

  useEffect(() => {
    // Guard: only run if not yet hydrated.
    // Zustand is a singleton — this won't run twice even in React Strict Mode
    // because isHydrated flips to true after the first call.
    if (!isHydrated) {
      hydrate(fetchUser);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Empty deps is intentional — we want this to run only on mount.
  // isHydrated is not needed here because we guard inside the effect.

  return <>{children}</>;
}