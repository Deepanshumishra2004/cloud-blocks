import type { ReactNode } from "react";

export function BillingCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="bg-[var(--cb-bg-surface)] border border-cb rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-cb">
        <h3 className="text-sm font-semibold text-cb-primary">{title}</h3>
        <p className="text-xs text-cb-muted mt-0.5">{description}</p>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}
