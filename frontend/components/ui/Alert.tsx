import * as React from "react";
import { cn } from "@/lib/cn";

type AlertVariant = "success" | "warning" | "danger" | "info";

const variantStyles: Record<AlertVariant, { wrapper: string; icon: string }> = {
  success: {
    wrapper: "bg-[var(--success-subtle)] border-[var(--success-border)] text-[var(--success)]",
    icon:    "✓",
  },
  warning: {
    wrapper: "bg-[var(--warning-subtle)] border-[var(--warning-border)] text-[var(--warning)]",
    icon:    "⚠",
  },
  danger: {
    wrapper: "bg-[var(--danger-subtle)] border-[var(--danger-border)] text-[var(--danger)]",
    icon:    "✕",
  },
  info: {
    wrapper: "bg-[var(--info-subtle)] border-[var(--info-border)] text-[var(--info)]",
    icon:    "ℹ",
  },
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant: AlertVariant;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  onDismiss?: () => void;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ variant, title, description, icon, onDismiss, className, children, ...props }, ref) => {
    const styles = variantStyles[variant];

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "flex gap-3 px-4 py-3 rounded-lg border text-sm",
          styles.wrapper,
          className
        )}
        {...props}
      >
        {/* Icon */}
        <span className="shrink-0 text-base mt-0.5 font-mono">
          {icon ?? styles.icon}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <p className="font-semibold leading-snug mb-0.5">{title}</p>
          )}
          {description && (
            <p className="text-xs opacity-80 leading-relaxed">{description}</p>
          )}
          {children}
        </div>

        {/* Dismiss */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 mt-0.5 opacity-60 hover:opacity-100 transition-opacity text-base leading-none"
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    );
  }
);
Alert.displayName = "Alert";

export { Alert, type AlertVariant };