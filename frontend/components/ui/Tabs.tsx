"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/* ============================================================
   TABS — horizontal tab navigation

   Usage:
     <Tabs defaultValue="repls">
       <TabsList>
         <TabsTrigger value="repls">My Repls</TabsTrigger>
         <TabsTrigger value="published">Published</TabsTrigger>
       </TabsList>
       <TabsContent value="repls">...</TabsContent>
       <TabsContent value="published">...</TabsContent>
     </Tabs>
   ============================================================ */

interface TabsContextValue {
  value: string;
  onChange: (v: string) => void;
}

const TabsContext = React.createContext<TabsContextValue>({
  value: "",
  onChange: () => {},
});

export interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}

function Tabs({ defaultValue, value, onValueChange, className, children }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue ?? "");

  const current = value ?? internal;
  const onChange = (v: string) => {
    setInternal(v);
    onValueChange?.(v);
  };

  return (
    <TabsContext.Provider value={{ value: current, onChange }}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

/* ── TabsList ── */
function TabsList({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex border-b border-cb overflow-x-auto",
        "scrollbar-hide",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ── TabsTrigger ── */
export interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

function TabsTrigger({ value, icon, badge, className, children, ...props }: TabsTriggerProps) {
  const ctx = React.useContext(TabsContext);
  const isActive = ctx.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      onClick={() => ctx.onChange(value)}
      className={cn(
        "flex items-center gap-2 px-4 py-2.5 shrink-0",
        "text-sm font-medium border-b-2 -mb-px",
        "transition-colors duration-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1",
        isActive
          ? "border-brand text-cb-primary"
          : "border-transparent text-cb-muted hover:text-cb-secondary hover:border-cb-strong",
        className
      )}
      {...props}
    >
      {icon && <span className="shrink-0 text-[14px]">{icon}</span>}
      {children}
      {badge !== undefined && (
        <span
          className={cn(
            "font-mono text-2xs px-1.5 py-0.5 rounded-full border",
            isActive
              ? "bg-[var(--brand-subtle)] text-brand border-[var(--brand-border)]"
              : "bg-cb-elevated text-cb-muted border-cb"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/* ── TabsContent ── */
export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function TabsContent({ value, className, children, ...props }: TabsContentProps) {
  const ctx = React.useContext(TabsContext);
  if (ctx.value !== value) return null;

  return (
    <div
      role="tabpanel"
      className={cn("outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };