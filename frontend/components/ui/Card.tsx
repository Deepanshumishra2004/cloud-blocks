import * as React from "react";
import { cn } from "@/lib/cn";

/* ============================================================
   CARD
   Composable card with optional header, body, footer.

   Usage:
     <Card>
       <CardHeader title="My Repls" description="6 active">
         <Button size="sm">New Repl</Button>
       </CardHeader>
       <CardBody>...</CardBody>
       <CardFooter>...</CardFooter>
     </Card>
   ============================================================ */

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Remove default border+bg — useful for nesting */
  bare?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ bare, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        !bare && [
          "bg-cb-surface border border-cb rounded-lg",
          "shadow-cb-sm overflow-hidden",
        ],
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = "Card";

/* ── CardHeader ── */
export interface CardHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, description, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-between gap-3",
        "px-5 py-4 border-b border-cb",
        className
      )}
      {...props}
    >
      {(title || description) && (
        <div className="flex-1 min-w-0">
          {title && (
            <p className="text-sm font-semibold text-cb-primary truncate">
              {title}
            </p>
          )}
          {description && (
            <p className="text-xs text-cb-muted mt-0.5">{description}</p>
          )}
        </div>
      )}
      {children}
    </div>
  )
);
CardHeader.displayName = "CardHeader";

/* ── CardBody ── */
const CardBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5", className)} {...props} />
));
CardBody.displayName = "CardBody";

/* ── CardFooter ── */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-end gap-2",
      "px-5 py-3 border-t border-cb bg-cb-elevated",
      className
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

/* ============================================================
   STAT CARD
   Usage: <StatCard label="Running Repls" value="3" change="+2" trend="up" />
   ============================================================ */
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
}

function StatCard({ label, value, change, trend = "neutral", icon, className, ...props }: StatCardProps) {
  const trendColor = {
    up:      "text-[var(--success)]",
    down:    "text-[var(--danger)]",
    neutral: "text-cb-muted",
  }[trend];

  const trendArrow = { up: "↑", down: "↓", neutral: "" }[trend];

  return (
    <div
      className={cn(
        "bg-cb-surface border border-cb rounded-lg p-5",
        "shadow-cb-sm",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-2xs font-semibold text-cb-muted uppercase tracking-wider">
          {label}
        </p>
        {icon && (
          <span className="text-cb-muted shrink-0">{icon}</span>
        )}
      </div>
      <p className="font-mono font-bold text-2xl text-cb-primary tracking-tight leading-none mb-1">
        {value}
      </p>
      {change && (
        <p className={cn("text-2xs font-mono flex items-center gap-0.5", trendColor)}>
          <span>{trendArrow}</span>
          <span>{change}</span>
        </p>
      )}
    </div>
  );
}

export { Card, CardHeader, CardBody, CardFooter, StatCard };