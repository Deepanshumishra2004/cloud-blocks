import type { BillingCycle, PlanName } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatPlanPrice, type PlanDefinition } from "./constants";

export function PlanGrid({
  plans,
  billingCycle,
  onBillingCycleChange,
  currentPlan,
  currentBillingCycle,
  loadingPlan,
  onUpgrade,
}: {
  plans: PlanDefinition[];
  billingCycle: BillingCycle;
  onBillingCycleChange: (cycle: BillingCycle) => void;
  currentPlan: PlanName;
  currentBillingCycle: BillingCycle;
  loadingPlan: string | null;
  onUpgrade: (plan: PlanName, cycle: BillingCycle) => void;
}) {
  const currentIndex = plans.findIndex((item) => item.id === currentPlan);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-cb-primary">Plans</h2>
        <div className="inline-flex rounded-lg border border-cb bg-[var(--cb-bg-surface)] p-0.5">
          <button
            type="button"
            onClick={() => onBillingCycleChange("MONTHLY")}
            className={cn(
              "px-3 py-1 text-xs rounded-md transition-colors",
              billingCycle === "MONTHLY" ? "bg-[var(--brand-subtle)] text-cb-primary" : "text-cb-muted hover:text-cb-primary"
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => onBillingCycleChange("YEARLY")}
            className={cn(
              "px-3 py-1 text-xs rounded-md transition-colors",
              billingCycle === "YEARLY" ? "bg-[var(--brand-subtle)] text-cb-primary" : "text-cb-muted hover:text-cb-primary"
            )}
          >
            Yearly
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const selectedPrice = plan.id === "FREE" ? 0 : plan.prices[billingCycle];
          const monthlyPrice = plan.prices.MONTHLY;
          const yearlyPrice = plan.prices.YEARLY;
          const yearlySavings =
            monthlyPrice && yearlyPrice ? Math.max(0, monthlyPrice * 12 - yearlyPrice) : 0;
          const isCurrent = plan.id === currentPlan;
          const planIndex = plans.findIndex((item) => item.id === plan.id);
          const isDowngrade = planIndex < currentIndex;
          const isSameCycle = plan.id === "FREE" || currentBillingCycle === billingCycle;
          const isCurrentSelection = isCurrent && isSameCycle;
          const isUnavailable = plan.id !== "FREE" && !selectedPrice;
          const loadingKey = `${plan.id}:${billingCycle}`;
          const cta = isCurrentSelection
            ? "Current plan"
            : plan.id === "FREE" || isDowngrade || isUnavailable
              ? "Not available"
              : isCurrent
                ? `Switch to ${billingCycle.toLowerCase()}`
                : `Upgrade to ${plan.label}`;

          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col gap-4 p-5 rounded-xl border bg-[var(--cb-bg-surface)]",
                plan.highlight ? "border-[var(--brand)] shadow-[0_0_0_1px_var(--brand)]" : "border-cb"
              )}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-brand text-[#111] text-2xs font-bold whitespace-nowrap">
                  Most Popular
                </span>
              )}

              <div>
                <p className="text-sm font-bold text-cb-primary">{plan.label}</p>
                <p className="mt-1">
                  <span className="text-2xl font-bold font-mono text-cb-primary">
                    {selectedPrice !== undefined ? formatPlanPrice(selectedPrice) : "N/A"}
                  </span>
                  <span className="text-xs text-cb-muted ml-1">
                    {plan.id === "FREE" ? "forever" : `/ ${billingCycle.toLowerCase()}`}
                  </span>
                </p>
                {billingCycle === "YEARLY" && yearlySavings > 0 && (
                  <p className="text-2xs text-[var(--success)] mt-1">
                    Save {formatPlanPrice(yearlySavings)} / year
                  </p>
                )}
              </div>

              <ul className="flex flex-col gap-1.5 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-xs text-cb-secondary">
                    <span className="text-[var(--success)]">+</span>
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.highlight ? "primary" : "outline"}
                size="sm"
                fullWidth
                loading={loadingPlan === loadingKey}
                disabled={isCurrentSelection || Boolean(loadingPlan) || isDowngrade || plan.id === "FREE" || isUnavailable}
                onClick={() => onUpgrade(plan.id, billingCycle)}
                className="mt-auto"
              >
                {cta}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
