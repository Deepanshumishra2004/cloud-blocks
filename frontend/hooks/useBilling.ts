"use client";
// src/hooks/useBilling.ts
//
// Centralizes subscription + usage state so both the layout (sidebar footer)
// and the billing page share the same data without double-fetching.
// Wrap your app in <BillingProvider> inside DashboardLayout.

import {
  createContext, useContext, useEffect, useState, useCallback,
  type ReactNode,
} from "react";
import {
  fetchSubscription, fetchUsage, createCheckoutSession, cancelSubscription,
  type Subscription, type Usage,
} from "@/lib/api";

interface BillingState {
  subscription: Subscription | null;
  usage:        Usage | null;
  loading:      boolean;
  upgrading:    string | null;   // plan id currently being upgraded to
  canceling:    boolean;
  refetch:      () => Promise<void>;
  upgrade:      (plan: "PRO" | "TEAMS") => Promise<void>;
  cancel:       () => Promise<void>;
}

const BillingContext = createContext<BillingState | null>(null);

export function BillingProvider({ children }: { children: ReactNode }) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage,        setUsage]        = useState<Usage | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [upgrading,    setUpgrading]    = useState<string | null>(null);
  const [canceling,    setCanceling]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sub, usg] = await Promise.all([fetchSubscription(), fetchUsage()]);
      setSubscription(sub);
      setUsage(usg);
    } catch {
      // Silently fall back — pages handle null gracefully
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function upgrade(plan: "PRO" | "TEAMS") {
    setUpgrading(plan);
    try {
      const url = await createCheckoutSession(plan, "MONTHLY");
      window.location.href = url; // Stripe takes over — no need to reset state
    } catch (err) {
      setUpgrading(null);
      throw err;
    }
  }

  async function cancel() {
    setCanceling(true);
    try {
      await cancelSubscription();
      await load(); // re-fetch to reflect canceled status
    } catch (err) {
      throw err;
    } finally {
      setCanceling(false);
    }
  }

  return (
    <BillingContext.Provider
      value={{ subscription, usage, loading, upgrading, canceling, refetch: load, upgrade, cancel }}
    >
      {children}
    </BillingContext.Provider>
  );
}

export function useBilling(): BillingState {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error("useBilling must be used within <BillingProvider>");
  return ctx;
}
