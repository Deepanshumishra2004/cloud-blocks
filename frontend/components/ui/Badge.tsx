import * as React from "react";
import { cn } from "@/lib/cn";

type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "brand";

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-cb-elevated text-cb-secondary border-cb",
  success: "bg-[var(--success-subtle)] text-[var(--success)] border-[var(--success-border)]",
  warning: "bg-[var(--warning-subtle)] text-[var(--warning)] border-[var(--warning-border)]",
  danger:  "bg-[var(--danger-subtle)]  text-[var(--danger)]  border-[var(--danger-border)]",
  info:    "bg-[var(--info-subtle)]    text-[var(--info)]    border-[var(--info-border)]",
  brand:   "bg-[var(--brand-subtle)]   text-brand            border-[var(--brand-border)]",
};

const dotColors: Record<BadgeVariant, string> = {
  default: "bg-cb-muted",
  success: "bg-[var(--success)]",
  warning: "bg-[var(--warning)]",
  danger:  "bg-[var(--danger)]",
  info:    "bg-[var(--info)]",
  brand:   "bg-brand",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "default", dot = false, className, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1",
          "font-mono text-2xs font-medium",
          "px-2 py-0.5 rounded-full border",
          "whitespace-nowrap leading-none",
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              "inline-block w-[5px] h-[5px] rounded-full shrink-0",
              dotColors[variant]
            )}
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

export { Badge, type BadgeVariant };