import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PanelTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1 text-xs rounded-md transition-colors",
        active ? "bg-white/10 text-white/90" : "text-white/35 hover:text-white/60 hover:bg-white/5"
      )}
    >
      {children}
    </button>
  );
}
