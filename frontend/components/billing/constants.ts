import type { BillingCycle, Plan, PlanName } from "@/lib/api";

export interface PlanDefinition {
  id: PlanName;
  label: string;
  prices: Partial<Record<BillingCycle, number>>;
  features: string[];
  highlight: boolean;
  maxRepls: number;
  maxStorageMB: number;
}

export const PLAN_ORDER: PlanName[] = ["FREE", "PRO", "TEAMS"];

const FALLBACK_PLANS: PlanDefinition[] = [
  { id: "FREE", label: "Free", prices: { MONTHLY: 0 }, features: ["3 repls", "500 MB storage"], highlight: false, maxRepls: 3, maxStorageMB: 500 },
  { id: "PRO", label: "Pro", prices: { MONTHLY: 1200, YEARLY: 9900 }, features: ["Unlimited repls", "5 GB storage"], highlight: true, maxRepls: -1, maxStorageMB: 5120 },
  { id: "TEAMS", label: "Teams", prices: { MONTHLY: 2900, YEARLY: 28900 }, features: ["Unlimited repls", "20 GB storage"], highlight: false, maxRepls: -1, maxStorageMB: 20480 },
];

function byPlanOrder(a: PlanName, b: PlanName): number {
  return PLAN_ORDER.indexOf(a) - PLAN_ORDER.indexOf(b);
}

export function formatPlanPrice(priceInCents: number): string {
  return (priceInCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function formatStorage(maxStorageMB: number): string {
  if (maxStorageMB >= 1024) {
    return `${Math.round((maxStorageMB / 1024) * 10) / 10} GB storage`;
  }
  return `${maxStorageMB} MB storage`;
}

function toLabel(name: PlanName): string {
  return name.charAt(0) + name.slice(1).toLowerCase();
}

export function buildPlanDefinitions(plans: Plan[]): PlanDefinition[] {
  if (plans.length === 0) return FALLBACK_PLANS;

  const onePerPlanName = new Map<PlanName, PlanDefinition>();
  for (const plan of plans) {
    const existing = onePerPlanName.get(plan.name);
    if (!existing) {
      onePerPlanName.set(plan.name, {
        id: plan.name,
        label: toLabel(plan.name),
        prices: { [plan.billingCycle]: plan.price },
        features: [
          plan.maxRepls === -1 ? "Unlimited repls" : `${plan.maxRepls} repls`,
          formatStorage(plan.maxStorageMB),
        ],
        highlight: plan.name === "PRO",
        maxRepls: plan.maxRepls,
        maxStorageMB: plan.maxStorageMB,
      });
      continue;
    }

    onePerPlanName.set(plan.name, {
      ...existing,
      prices: { ...existing.prices, [plan.billingCycle]: plan.price },
      maxRepls: plan.billingCycle === "MONTHLY" ? plan.maxRepls : existing.maxRepls,
      maxStorageMB: plan.billingCycle === "MONTHLY" ? plan.maxStorageMB : existing.maxStorageMB,
      features:
        plan.billingCycle === "MONTHLY"
          ? [plan.maxRepls === -1 ? "Unlimited repls" : `${plan.maxRepls} repls`, formatStorage(plan.maxStorageMB)]
          : existing.features,
    });
  }

  if (!onePerPlanName.has("FREE")) {
    onePerPlanName.set("FREE", FALLBACK_PLANS.find((plan) => plan.id === "FREE")!);
  }

  const mapped = Array.from(onePerPlanName.values()).sort((a, b) => byPlanOrder(a.id, b.id));
  return mapped.length > 0 ? mapped : FALLBACK_PLANS;
}

export const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "default"> = {
  ACTIVE: "success",
  TRIAL: "warning",
  PAST_DUE: "danger",
  CANCELED: "danger",
  EXPIRED: "danger",
};

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function formatShortDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatMoney(amount: number, currency: string): string {
  return (amount / 100).toLocaleString("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  });
}
