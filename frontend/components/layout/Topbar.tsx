"use client";
// src/components/layout/Topbar.tsx
import * as React from "react";
import { cn }          from "@/lib/cn";
import { Avatar }      from "@/components/ui/Misc";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export interface BreadcrumbItem {
  label:    string;
  href?:    string;
  onClick?: () => void;
}

export interface TopbarProps {
  breadcrumbs?: BreadcrumbItem[];
  // isDark / onThemeToggle kept for API compat — ThemeToggle reads context
  isDark?:        boolean;
  onThemeToggle?: () => void;
  user?:          { initials?: string; src?: string };
  actions?:       React.ReactNode;
  className?:     string;
}

function Topbar({ breadcrumbs, user, actions, className }: TopbarProps) {
  return (
    <header className={cn(
      "sticky top-0 z-40",
      "h-[52px] flex items-center gap-4 px-5",
      "bg-[var(--cb-bg-surface)] border-b border-cb",
      className
    )}>

      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
          {breadcrumbs.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-cb-disabled text-xs shrink-0">›</span>}
              {item.href || item.onClick ? (
                <button
                  onClick={item.onClick}
                  className={cn(
                    "truncate transition-colors duration-100",
                    i === breadcrumbs.length - 1
                      ? "text-cb-primary font-medium"
                      : "text-cb-muted hover:text-cb-secondary"
                  )}
                >{item.label}</button>
              ) : (
                <span className={cn(
                  "truncate",
                  i === breadcrumbs.length - 1 ? "text-cb-primary font-medium" : "text-cb-muted"
                )}>{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Right side */}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        <ThemeToggle />
        <TopbarIconButton title="Notifications" aria-label="Notifications">
          <BellIcon />
        </TopbarIconButton>
        {actions}
        {user && !actions && (
          <Avatar initials={user.initials} src={user.src} size="sm" className="cursor-pointer" />
        )}
      </div>
    </header>
  );
}

export function TopbarIconButton({
  className, children, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "w-[30px] h-[30px] flex items-center justify-center rounded-md border border-cb",
        "text-cb-muted hover:text-cb-primary hover:bg-[var(--cb-bg-hover)]",
        "transition-colors duration-100",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand",
        className
      )}
      {...props}
    >{children}</button>
  );
}

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8 1a5 5 0 015 5v4l1.5 1.5H1.5L3 10V6a5 5 0 015-5z"/>
      <path d="M6.5 13a1.5 1.5 0 003 0"/>
    </svg>
  );
}

export { Topbar };