import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Misc";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  subtitle,
  icon,
  accentClass,
}: {
  label: string;
  value: ReactNode;
  subtitle: string;
  icon: ReactNode;
  accentClass: string;
}) {
  return (
    <div className="bg-[var(--cb-bg-surface)] border border-cb rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-2xs font-semibold text-cb-muted uppercase tracking-wider">{label}</span>
        <span className={cn("opacity-70", accentClass)}>{icon}</span>
      </div>

      <div>
        {value === null ? (
          <Skeleton height={28} width={40} />
        ) : (
          <p className={cn("text-2xl font-bold font-mono tracking-tight", accentClass)}>{value}</p>
        )}
        <p className="text-2xs text-cb-muted mt-1">{subtitle}</p>
      </div>
    </div>
  );
}
