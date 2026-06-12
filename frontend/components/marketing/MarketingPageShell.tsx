import type { ReactNode } from "react";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingNav } from "@/components/landing/LandingNav";
import { ShaderBackground } from "@/components/landing/ShaderBackground";

export function MarketingPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-cb-page">
      <ShaderBackground />
      <LandingNav />
      <main className="relative z-10 px-4 pb-24 pt-28">{children}</main>
      <LandingFooter />
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="landing-container py-16 text-center">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-cb-muted">
        {eyebrow}
      </p>
      <h1 className="mx-auto mt-5 max-w-4xl text-balance text-[46px] font-bold leading-[0.98] text-cb-primary sm:text-[72px]">
        {title}
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-cb-secondary">
        {description}
      </p>
    </section>
  );
}

export function MarketingCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <article className="motion-card shine-border premium-panel border border-cb p-6">
      <h2 className="text-xl font-bold text-cb-primary">{title}</h2>
      {description && (
        <p className="mt-3 text-sm leading-6 text-cb-secondary">{description}</p>
      )}
      {children}
    </article>
  );
}
