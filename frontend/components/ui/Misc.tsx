import * as React from "react";
import { cn } from "@/lib/cn";

/* ============================================================
   PROGRESS BAR
   ============================================================ */
export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;        // 0–100
  max?: number;
  variant?: "brand" | "success" | "danger" | "warning";
  size?: "sm" | "md";
  label?: string;
  showValue?: boolean;
}

const progressColors = {
  brand:   "bg-brand",
  success: "bg-[var(--success)]",
  danger:  "bg-[var(--danger)]",
  warning: "bg-[var(--warning)]",
};

function Progress({
  value,
  max = 100,
  variant = "brand",
  size = "sm",
  label,
  showValue = false,
  className,
  ...props
}: ProgressProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn("w-full", className)} {...props}>
      {(label || showValue) && (
        <div className="flex justify-between items-center mb-1">
          {label && (
            <span className="text-2xs text-cb-muted">{label}</span>
          )}
          {showValue && (
            <span className="text-2xs font-mono text-cb-secondary">
              {value}/{max}
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn(
          "w-full rounded-full bg-cb-elevated overflow-hidden border border-cb",
          size === "sm" ? "h-[5px]" : "h-2"
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            progressColors[variant]
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ============================================================
   AVATAR
   ============================================================ */
export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  initials?: string;
  src?: string;
  alt?: string;
  size?: "xs" | "sm" | "md" | "lg";
  online?: boolean;
}

const avatarSizes = {
  xs: "w-6 h-6 text-2xs",
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
};

function Avatar({ initials, src, alt, size = "md", online, className, ...props }: AvatarProps) {
  return (
    <div className={cn("relative shrink-0", className)} {...props}>
      <div
        className={cn(
          "rounded-full flex items-center justify-center overflow-hidden",
          "font-mono font-semibold",
          "bg-[var(--brand-subtle)] text-brand border border-[var(--brand-border)]",
          avatarSizes[size]
        )}
      >
        {src ? (
          <img src={src} alt={alt ?? initials ?? "avatar"} className="w-full h-full object-cover" />
        ) : (
          <span>{initials ?? "?"}</span>
        )}
      </div>
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 w-2 h-2 rounded-full border-2",
            "border-cb-surface",
            online ? "bg-[var(--success)]" : "bg-cb-muted"
          )}
        />
      )}
    </div>
  );
}

/* ============================================================
   DIVIDER
   ============================================================ */
export interface DividerProps {
  label?: string;
  className?: string;
}

function Divider({ label, className }: DividerProps) {
  if (label) {
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <div className="flex-1 h-px bg-cb-border" />
        <span className="text-2xs font-semibold text-cb-muted uppercase tracking-wider shrink-0">
          {label}
        </span>
        <div className="flex-1 h-px bg-cb-border" />
      </div>
    );
  }
  return <div className={cn("h-px w-full bg-cb-border", className)} />;
}

/* ============================================================
   SKELETON (loading placeholder)
   ============================================================ */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
}

function Skeleton({ width, height, className, style, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-cb-elevated animate-pulse",
        className
      )}
      style={{ width, height, ...style }}
      {...props}
    />
  );
}

/* ============================================================
   TOOLTIP WRAPPER (simple title-based)
   For full tooltip: use Radix UI tooltip in production
   ============================================================ */
export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
}

function Tooltip({ content, children, className }: TooltipProps) {
  return (
    <span title={content} className={cn("cursor-default", className)}>
      {children}
    </span>
  );
}

/* ============================================================
   KBD (keyboard shortcut display)
   ============================================================ */
function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center",
        "font-mono text-2xs font-medium",
        "px-1.5 py-0.5 rounded border",
        "bg-cb-elevated border-cb text-cb-secondary",
        className
      )}
    >
      {children}
    </kbd>
  );
}

/* ============================================================
   CODE BLOCK / TERMINAL
   ============================================================ */
export interface CodeBlockProps {
  lines: Array<{
    type: "prompt" | "cmd" | "output" | "success" | "error" | "comment";
    content: string;
  }>;
  title?: string;
  className?: string;
}

function CodeBlock({ lines, title, className }: CodeBlockProps) {
  const lineColors = {
    prompt:  "text-brand",
    cmd:     "text-cb-primary",
    output:  "text-cb-muted",
    success: "text-[var(--success)]",
    error:   "text-[var(--danger)]",
    comment: "text-cb-disabled",
  };

  return (
    <div className={cn("rounded-lg border border-cb overflow-hidden", className)}>
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2 bg-cb-elevated border-b border-cb">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        {title && (
          <span className="mx-auto text-2xs font-mono text-cb-muted">
            {title}
          </span>
        )}
      </div>
      {/* Body */}
      <div className="bg-black p-4 font-mono text-xs leading-[1.8] overflow-x-auto code-scroll">
        {lines.map((line, i) => (
          <div key={i} className={lineColors[line.type]}>
            {line.type === "prompt" ? (
              <>
                <span className="text-brand select-none">$ </span>
                <span className="text-cb-primary">{line.content}</span>
              </>
            ) : (
              line.content
            )}
          </div>
        ))}
        {/* Cursor */}
        <div className="flex items-center">
          <span className="text-brand select-none">$ </span>
          <span className="inline-block w-[7px] h-[13px] bg-brand ml-0.5 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export { Progress, Avatar, Divider, Skeleton, Tooltip, Kbd, CodeBlock };