"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authstore";
import api from "@/lib/api";

export function useAuth({ required = false } = {}) {
  const { user, token, isHydrated, logout } = useAuthStore();
  const router = useRouter();

  // After hydration: redirect to signin if this page requires auth.
  // Hydration itself is initiated once by AuthProvider in the root layout —
  // no duplicate fetchUser() calls here.
  useEffect(() => {
    if (isHydrated && required && !user) {
      router.replace("/signin");
    }
  }, [isHydrated, required, user, router]);

  const signout = useCallback(async () => {
    try {
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

// Convenience alias for protected pages/layouts.
export function useRequireAuth() {
  return useAuth({ required: true });
}
