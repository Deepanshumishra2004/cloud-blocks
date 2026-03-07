import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-cb-primary">{title}</h2>
        {action}
      </div>
      <div className={cn("flex flex-col")}>{children}</div>
    </section>
  );
}
