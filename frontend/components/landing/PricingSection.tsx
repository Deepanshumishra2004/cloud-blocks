"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

const PLANS = [
  {
    name: "Starter",
    eyebrow: "Explore",
    price: { monthly: 0, annual: 0 },
    desc: "For trying CloudBlocks, demos, and small personal projects.",
    features: ["3 active sandboxes", "512 MB RAM per sandbox", "Live preview URL", "500 MB storage"],
    cta: "Get started free",
    href: "/signup",
  },
  {
    name: "Pro",
    eyebrow: "Ship",
    price: { monthly: 12, annual: 9 },
    desc: "For builders shipping real apps with faster runtimes and snapshots.",
    features: ["10 active sandboxes", "2 GB RAM per sandbox", "S3 snapshots", "Priority runtimes"],
    cta: "Start Pro trial",
    href: "/signup?plan=pro",
    featured: true,
  },
  {
    name: "Teams",
    eyebrow: "Scale",
    price: { monthly: 29, annual: 22 },
    desc: "For teams that need shared workspaces, access control, and governance.",
    features: ["Unlimited sandboxes", "4 GB RAM per sandbox", "SSO ready", "Audit-friendly activity"],
    cta: "Contact sales",
    href: "/contact",
  },
];

export function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="relative overflow-hidden px-4 py-24">
      <div className="pointer-events-none absolute left-1/2 top-24 h-64 w-[720px] -translate-x-1/2 rounded-full bg-brand/5 blur-3xl" />
      <div className="landing-container">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-cb-muted">Pricing</p>
          <h2 className="mt-4 text-balance text-[42px] font-bold leading-[1.04] text-cb-primary sm:text-[58px]">
            Start free, scale when your app grows
          </h2>
          <div className="mt-8 flex justify-center">
            <div className="pricing-toggle relative inline-grid grid-cols-2 rounded-full border border-cb-strong bg-cb-surface p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_54px_rgba(0,0,0,0.16)]">
              <span
                className={cn(
                  "absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-full bg-[var(--brand)] shadow-[0_0_30px_rgba(20,152,255,0.2)] transition-transform duration-300",
                  annual ? "translate-x-[calc(100%+4px)]" : "translate-x-0"
                )}
              />
              {[
                { label: "Monthly", value: false },
                { label: "Annual", sub: "Save 25%", value: true },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setAnnual(option.value)}
                  className={cn(
                    "relative z-10 flex h-10 min-w-[118px] items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition-colors duration-200",
                    annual === option.value ? "text-[#050505]" : "text-cb-secondary hover:text-cb-primary"
                  )}
                >
                  <span>{option.label}</span>
                  {option.sub && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-mono text-[10px]",
                        annual === option.value ? "bg-black/10 text-[#050505]" : "bg-white/[0.06] text-brand"
                      )}
                    >
                      {option.sub}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const price = annual ? plan.price.annual : plan.price.monthly;
            const annualTotal = plan.price.annual * 12;
            return (
              <article
                key={plan.name}
                className={cn(
                  "motion-card shine-border premium-panel relative flex min-h-[460px] flex-col overflow-hidden rounded-[2px] border p-7",
                  plan.featured
                    ? "border-brand shadow-[0_0_0_1px_var(--brand),0_30px_100px_rgba(20,152,255,0.08)]"
                    : "border-cb"
                )}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                {plan.featured && (
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-28 bg-brand/10 blur-3xl" />
                )}
                {plan.featured && (
                  <span className="absolute right-5 top-5 rounded-full border border-brand/50 bg-brand/10 px-3 py-1 font-mono text-[10px] font-bold uppercase text-brand">
                    Popular
                  </span>
                )}
                <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-cb-muted">
                  {plan.eyebrow}
                </p>
                <h3 className="mt-3 text-2xl font-bold text-cb-primary">{plan.name}</h3>
                <p className="mt-3 min-h-16 text-sm leading-6 text-cb-secondary">{plan.desc}</p>
                <div className="mt-8">
                  <span className="font-mono text-5xl font-bold text-cb-primary">${price}</span>
                  <span className="font-mono text-sm text-cb-muted">
                    {price > 0 ? " / mo" : " forever"}
                  </span>
                  <p className="mt-2 h-5 text-xs text-cb-muted">
                    {price > 0
                      ? annual
                        ? `$${annualTotal} billed yearly`
                        : "Billed monthly, cancel anytime"
                      : "No card required"}
                  </p>
                </div>
                <Button
                  variant={plan.featured ? "primary" : "outline"}
                  size="md"
                  fullWidth
                  asChild
                  className="mt-7 rounded-full"
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
                <div className="mt-7 border-t border-cb pt-5">
                  <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-cb-muted">
                    Includes
                  </p>
                  {plan.features.map((feature) => (
                    <div key={feature} className="mb-3 flex items-center gap-3 text-sm text-cb-secondary transition-colors hover:text-cb-primary">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-brand/30 bg-brand/10 text-brand">
                        <CheckIcon />
                      </span>
                      {feature}
                    </div>
                  ))}
                </div>
                {plan.featured && (
                  <p className="mt-auto rounded-md border border-brand/20 bg-brand/10 px-3 py-2 text-xs text-brand">
                    Best for solo builders and early product teams.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="m2.5 6.2 2 2 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
