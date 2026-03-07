"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Misc";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/hooks/useAuth";
import {
  cancelSubscription,
  createCheckoutSession,
  fetchAllPlans,
  fetchPaymentHistory,
  fetchSubscription,
  fetchUsage,
  type Payment,
  type BillingCycle,
  type Plan,
  type PlanName,
  type Subscription,
  type Usage,
} from "@/lib/api";
import { BillingCard } from "@/components/billing/BillingCard";
import { buildPlanDefinitions, formatDate, STATUS_VARIANT } from "@/components/billing/constants";
import { PaymentHistory } from "@/components/billing/PaymentHistory";
import { PlanGrid } from "@/components/billing/PlanGrid";
import { UsageMeter } from "@/components/billing/UsageMeter";

function BillingPageInner() {
  useRequireAuth();

  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<BillingCycle>("MONTHLY");
  const [upgradingPlan, setUpgradingPlan] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    if (subscription?.plan.name && subscription.plan.name !== "FREE") {
      setSelectedBillingCycle(subscription.plan.billingCycle);
    }
  }, [subscription]);

  useEffect(() => {
    if (searchParams.get("session_id")) {
      toast.success("Payment successful", "Your plan has been upgraded.");
    }
    if (searchParams.get("canceled")) {
      toast.info("Checkout canceled", "No charges were made.");
    }

    Promise.all([fetchSubscription(), fetchUsage(), fetchPaymentHistory(), fetchAllPlans()])
      .then(([nextSub, nextUsage, nextPayments, nextPlans]) => {
        setSubscription(nextSub);
        setUsage(nextUsage);
        setPayments(nextPayments);
        setPlans(nextPlans);
      })
      .finally(() => setLoading(false));
  }, [searchParams, toast]);

  async function handleUpgrade(plan: PlanName, billingCycle: BillingCycle) {
    if (plan === "FREE" || (plan === subscription?.plan.name && billingCycle === subscription?.plan.billingCycle)) {
      return;
    }

    setUpgradingPlan(`${plan}:${billingCycle}`);
    try {
      const url = await createCheckoutSession(plan as "PRO" | "TEAMS", billingCycle);
      window.location.href = url;
    } catch {
      toast.error("Checkout failed", "Please try again.");
      setUpgradingPlan(null);
    }
  }

  async function handleCancel() {
    setCanceling(true);
    try {
      await cancelSubscription();
      setSubscription(await fetchSubscription());
      setShowCancelConfirm(false);
      toast.success("Plan canceled", "Access continues until the period ends.");
    } catch {
      toast.error("Failed to cancel", "Please contact support.");
    } finally {
      setCanceling(false);
    }
  }

  const currentPlanName = subscription?.plan.name ?? "FREE";
  const availablePlans = useMemo(() => buildPlanDefinitions(plans), [plans]);
  const currentPlan = useMemo(
    () => availablePlans.find((plan) => plan.id === currentPlanName) ?? availablePlans[0],
    [availablePlans, currentPlanName]
  );
  const renewalDate =
    subscription?.plan.name !== "FREE" && subscription?.currentPeriodEnd
      ? formatDate(subscription.currentPeriodEnd)
      : null;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-cb-primary tracking-tight">Billing</h1>
        <p className="text-sm text-cb-secondary mt-1">Manage your plan, usage, and payment history.</p>
      </div>

      <BillingCard title="Current Plan" description="Your active subscription and renewal date.">
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton height={24} width={140} />
            <Skeleton height={16} width={220} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[var(--brand-subtle)] border border-[var(--brand-border)] flex items-center justify-center text-cb-primary">
                  {currentPlan.label.slice(0, 1)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-cb-primary">{currentPlan.label} Plan</p>
                    {subscription && (
                      <Badge variant={STATUS_VARIANT[subscription.status] ?? "default"} dot>
                        {subscription.status.charAt(0) + subscription.status.slice(1).toLowerCase()}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-cb-muted mt-0.5">
                    {subscription?.plan.name !== "FREE" ? `Billed ${subscription?.plan.billingCycle.toLowerCase()} - ` : ""}
                    {renewalDate
                      ? subscription?.status === "CANCELED"
                        ? `Access until ${renewalDate}`
                        : `Renews ${renewalDate}`
                      : "Free plan - no renewal"}
                  </p>
                </div>
              </div>

              {subscription?.plan.name !== "FREE" && subscription?.status === "ACTIVE" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--danger)] hover:bg-[var(--danger-subtle)] shrink-0"
                  onClick={() => setShowCancelConfirm(true)}
                >
                  Cancel plan
                </Button>
              )}
            </div>

            {showCancelConfirm && (
              <div className="mt-4 p-4 bg-[var(--danger-subtle)] border border-[var(--danger-border)] rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-sm text-[var(--danger)]">
                  Cancel subscription? Access continues until <strong>{renewalDate}</strong>.
                </p>
                <div className="flex gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setShowCancelConfirm(false)}>
                    Keep plan
                  </Button>
                  <Button variant="danger" size="sm" loading={canceling} onClick={handleCancel}>
                    Confirm
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </BillingCard>

      <BillingCard title="Usage" description="Resource consumption this billing period.">
        {loading ? (
          <div className="flex flex-col gap-4">{[0, 1].map((i) => <Skeleton key={i} height={44} />)}</div>
        ) : (
          <div className="flex flex-col gap-5">
            <UsageMeter
              label="Repls"
              used={usage?.repls.used ?? 0}
              max={usage?.repls.max ?? currentPlan.maxRepls}
              unit="repls"
              unlimited={currentPlan.maxRepls === -1}
            />
            <UsageMeter
              label="Storage"
              used={usage?.storage.usedMb ?? 0}
              max={usage?.storage.maxMb ?? currentPlan.maxStorageMB}
              unit="MB"
            />
          </div>
        )}
      </BillingCard>

      <PlanGrid
        plans={availablePlans}
        billingCycle={selectedBillingCycle}
        onBillingCycleChange={setSelectedBillingCycle}
        currentPlan={currentPlanName}
        currentBillingCycle={subscription?.plan.billingCycle ?? "MONTHLY"}
        loadingPlan={upgradingPlan}
        onUpgrade={handleUpgrade}
      />

      <PaymentHistory payments={payments} />

      <p className="text-xs text-cb-muted text-center">
        Payments are processed by Stripe. Invoices are emailed automatically. {" "}
        <a href="mailto:support@cloudblocks.dev" className="text-[var(--brand)] hover:underline">
          Contact support
        </a>
      </p>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={
    <div className="p-6 flex flex-col gap-4">
      <Skeleton height={120} />
      <Skeleton height={200} />
      </div>
    }>
      <BillingPageInner />
    </Suspense>
  );
}
