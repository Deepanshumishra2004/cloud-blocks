"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Misc";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface TopbarProps {
  breadcrumbs?: BreadcrumbItem[];
  isDark?: boolean;
  onThemeToggle?: () => void;
  user?: { initials?: string; src?: string };
  actions?: React.ReactNode;
  className?: string;
}

function Topbar({ breadcrumbs, user, actions, className }: TopbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-[56px] items-center gap-4 px-6",
        "border-b border-cb bg-[color-mix(in_srgb,var(--cb-bg-surface)_88%,transparent)] backdrop-blur-xl",
        "shadow-[0_10px_30px_color-mix(in_srgb,var(--cb-bg-page)_72%,transparent)]",
        className
      )}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          {breadcrumbs.map((item, i) => (
            <React.Fragment key={`${item.label}-${i}`}>
              {i > 0 && <span className="shrink-0 text-xs text-cb-disabled">/</span>}
              {item.href || item.onClick ? (
                <button
                  onClick={item.onClick}
                  className={cn(
                    "truncate transition-colors duration-100",
                    i === breadcrumbs.length - 1
                      ? "font-medium text-cb-primary"
                      : "text-cb-muted hover:text-cb-secondary"
                  )}
                  type="button"
                >
                  {item.label}
                </button>
              ) : (
                <span
                  className={cn(
                    "truncate",
                    i === breadcrumbs.length - 1 ? "font-medium text-cb-primary" : "text-cb-muted"
                  )}
                >
                  {item.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <TopbarIconButton title="Notifications" aria-label="Notifications">
          <BellIcon />
        </TopbarIconButton>
        {actions}
        {user && !actions && <Avatar initials={user.initials} src={user.src} size="sm" className="cursor-pointer" />}
      </div>
    </header>
  );
}

export function TopbarIconButton({ className, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "flex h-[32px] w-[32px] items-center justify-center rounded-md border border-cb",
        "bg-cb-elevated text-cb-muted transition-colors duration-150 hover:border-cb-strong hover:bg-[var(--cb-bg-hover)] hover:text-cb-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
        className
      )}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
}

function BellIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M8 1a5 5 0 015 5v4l1.5 1.5H1.5L3 10V6a5 5 0 015-5z" />
      <path d="M6.5 13a1.5 1.5 0 003 0" />
    </svg>
  );
}

export { Topbar };
