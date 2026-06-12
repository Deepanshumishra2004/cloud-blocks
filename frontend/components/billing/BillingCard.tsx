import type { ReactNode } from "react";

export function BillingCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="dashboard-panel overflow-hidden">
      <div className="px-5 py-4 border-b border-cb bg-[color-mix(in_srgb,var(--cb-bg-elevated)_38%,transparent)]">
        <h3 className="text-sm font-semibold text-cb-primary">{title}</h3>
        <p className="text-xs text-cb-muted mt-0.5">{description}</p>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}
