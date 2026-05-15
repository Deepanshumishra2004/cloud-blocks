"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/authstore";
import { fetchUser } from "@/lib/api";

// Mounted once in the root layout. Fires hydrate() on app start.
// The authstore guards against concurrent or duplicate calls — calling
// hydrate() here is safe even if other hooks also call it.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate(fetchUser);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
