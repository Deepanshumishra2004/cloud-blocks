"use client";
// src/components/landing/PricingSection.tsx
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

const PLANS = [
  {
    name:     "Starter",
    price:    { monthly: 0,  annual: 0  },
    desc:     "Perfect for learning and personal projects.",
    features: [
      "3 active repls",
      "512 MB RAM per repl",
      "0.5 vCPU",
      "500 MB storage",
      "Community support",
      "cloudblocks.dev subdomain",
    ],
    cta:      "Get started free",
    href:     "/signup",
    featured: false,
  },
  {
    name:     "Pro",
    price:    { monthly: 12, annual: 9  },
    desc:     "For developers who build seriously.",
    features: [
      "10 active repls",
      "2 GB RAM per repl",
      "2 vCPU",
      "5 GB storage",
      "Email support",
      "Custom subdomain",
      "S3 snapshot backups",
      "Priority pods",
    ],
    cta:      "Start Pro trial",
    href:     "/signup?plan=pro",
    featured: true,
  },
  {
    name:     "Teams",
    price:    { monthly: 29, annual: 22 },
    desc:     "Collaborate across your whole team.",
    features: [
      "Unlimited repls",
      "4 GB RAM per repl",
      "4 vCPU",
      "50 GB storage",
      "Priority support",
      "SSO / SAML",
      "Audit logs",
      "Team management",
      "Private repls",
    ],
    cta:      "Contact sales",
    href:     "/contact",
    featured: false,
  },
];

export function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="relative py-28 px-6">
      {/* Header */}
      <div className="text-center mb-12">
        <p className="font-mono text-xs text-brand font-semibold uppercase tracking-widest mb-3">
          Pricing
        </p>
        <h2 className="font-sans font-bold text-4xl md:text-5xl text-cb-primary tracking-tight">
          Simple, honest pricing.
        </h2>
        <p className="mt-4 text-cb-secondary max-w-sm mx-auto">
          Start free. Scale when you need to.
        </p>

        {/* Toggle */}
        <div className="mt-6">
        <div className="relative inline-flex items-center w-[200px] h-12 rounded-full border-2 border-yellow-400 bg-cb-elevated p-1">

          {/* Sliding Background */}
          <span
            className={cn(
              "absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-yellow-400 transition-transform duration-300 ease-in-out",
              annual ? "translate-x-full" : "translate-x-0"
            )}
          />

          {/* Monthly */}
          <button
            onClick={() => setAnnual(false)}
            className={cn(
              "relative z-10 w-1/2 text-sm font-mono font-medium transition-colors duration-200",
              !annual ? "text-black" : "text-cb-secondary"
            )}
          >
            Monthly
          </button>

          {/* Annual */}
          <button
            onClick={() => setAnnual(true)}
            className={cn(
              "relative z-10 w-1/2 text-sm font-mono font-medium transition-colors duration-200 flex items-center justify-center gap-1",
              annual ? "text-black" : "text-cb-secondary"
            )}
          >
            Annual
            <span
              className={cn(
                "text-[10px] font-bold",
                annual ? "text-black" : "text-yellow-400"
              )}
            >
              −25%
            </span>
          </button>
        </div>
      </div>
      </div>

      {/* Cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
        {PLANS.map((plan) => (
          <PricingCard key={plan.name} plan={plan} annual={annual} />
        ))}
      </div>
    </section>
  );
}

function PricingCard({
  plan,
  annual,
}: {
  plan: (typeof PLANS)[0];
  annual: boolean;
}) {
  const price = annual ? plan.price.annual : plan.price.monthly;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-xl border p-8",
        "transition-all duration-200",
        plan.featured
          ? "pt-12 bg-cb-elevated border-brand shadow-[0_0_0_1px_var(--brand)] shadow-cb-lg"
          : "bg-cb-surface border-cb hover:border-cb-strong"
      )}
    >
      {plan.featured && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Badge
            variant="brand"
            className="font-mono text-xs px-3 shadow-sm bg-amber-600"
          >
            Most popular
          </Badge>
        </div>
      )}

      <p className="font-semibold text-sm text-cb-primary">{plan.name}</p>
      <p className="text-xs text-cb-muted mt-1 mb-5">{plan.desc}</p>

      {/* Price */}
      <div className="mb-6">
        <span className="font-mono font-bold text-4xl text-cb-primary">
          ${price}
        </span>

        {price > 0 ? (
          <span className="text-sm text-cb-muted font-mono"> / mo</span>
        ) : (
          <span className="text-sm text-cb-muted font-mono"> forever</span>
        )}

        {annual && plan.price.monthly > 0 && (
          <p className="text-xs text-cb-muted font-mono mt-1">
            <span className="line-through">
              ${plan.price.monthly}/mo
            </span>{" "}
            billed annually
          </p>
        )}
      </div>

      <Button
        variant={plan.featured ? "primary" : "outline"}
        size="md"
        fullWidth
        asChild
      >
        <Link href={plan.href}>{plan.cta}</Link>
      </Button>

      <div className="mt-6 pt-5 border-t border-cb flex flex-col gap-2.5">
        {plan.features.map((f) => (
          <div key={f} className="flex items-start gap-2.5">
            <span className="text-brand text-xs mt-0.5 shrink-0">✓</span>
            <span className="text-xs text-cb-secondary">{f}</span>
          </div>
        ))}
      </div>
    </div>
  );
}