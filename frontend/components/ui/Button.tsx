import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/cn";

/*
  Install: npm install @radix-ui/react-slot

  asChild merges Button's classes + event handlers onto its child element.
  Use it to render a Next.js <Link> with Button styles, with no extra DOM node:

    <Button variant="primary" asChild>
      <Link href="/dashboard">Go to dashboard</Link>
    </Button>
*/

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "link";

type ButtonSize = "xs" | "sm" | "md" | "lg" | "icon-xs" | "icon-sm" | "icon-md";

const variantStyles: Record<ButtonVariant, string> = {
  primary: [
    "bg-brand text-cb-primary border-brand",
    "hover:bg-brand-hover hover:border-brand-hover",
    "active:scale-[0.98]",
  ].join(" "),

  secondary: [
    "bg-cb-elevated text-cb-primary border-cb-strong",
    "hover:bg-cb-hover",
    "active:scale-[0.98]",
  ].join(" "),

  outline: [
    "bg-transparent text-cb-primary border-cb-strong",
    "hover:bg-cb-hover",
    "active:scale-[0.98]",
  ].join(" "),

  ghost: [
    "bg-transparent text-cb-secondary border-transparent",
    "hover:bg-cb-hover hover:text-cb-primary",
    "active:scale-[0.98]",
  ].join(" "),

  danger: [
    "bg-[var(--danger-subtle)] text-[var(--danger)] border-[var(--danger-border)]",
    "hover:bg-[var(--danger)] hover:text-white hover:border-[var(--danger)]",
    "active:scale-[0.98]",
  ].join(" "),

  link: [
    "bg-transparent text-brand border-transparent underline-offset-4",
    "hover:underline",
    "p-0 h-auto",
  ].join(" "),
};

const sizeStyles: Record<ButtonSize, string> = {
  xs:        "h-6 px-2.5 text-2xs font-medium",
  sm:        "h-[30px] px-3 text-xs font-medium",
  md:        "h-9 px-3.5 text-sm font-medium",
  lg:        "h-[42px] px-5 text-base font-medium",
  "icon-xs": "h-6 w-6 p-0",
  "icon-sm": "h-[30px] w-[30px] p-0",
  "icon-md": "h-9 w-9 p-0",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:   ButtonVariant;
  size?:      ButtonSize;
  loading?:   boolean;
  fullWidth?: boolean;
  leftIcon?:  React.ReactNode;
  rightIcon?: React.ReactNode;
  /** Merge styles onto child element instead of rendering a <button> */
  asChild?:   boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant   = "secondary",
      size      = "md",
      loading   = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      type,
      className,
      children,
      disabled,
      asChild = false,
      ...props
    },
    ref
  ) => {
    const Comp: React.ElementType = asChild ? Slot : "button";
    const isDisabled = disabled || loading;

    return (
      <Comp
        ref={ref}
        type={type ?? "button"}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center gap-2",
          "rounded-md border font-sans",
          "cursor-pointer select-none whitespace-nowrap",
          "transition-all duration-100",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading ? (
          <Spinner size={size === "lg" ? 16 : 14} />
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </Comp>
    );
  }
);

Button.displayName = "Button";

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      className="animate-spin"
      aria-hidden
    >
      <circle
        cx="7" cy="7" r="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="28"
        strokeDashoffset="10"
        strokeLinecap="round"
        opacity="0.3"
      />
      <circle
        cx="7" cy="7" r="5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export { Button, type ButtonVariant, type ButtonSize };
