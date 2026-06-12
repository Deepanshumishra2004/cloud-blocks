"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { Progress } from "@/components/ui/Misc";
import { Button } from "@/components/ui/Button";

function Sidebar({ className, children }: React.HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 z-50 w-[var(--sidebar-width)]",
        "flex flex-col overflow-y-auto border-r border-cb",
        "bg-[linear-gradient(180deg,color-mix(in_srgb,var(--cb-bg-surface)_96%,var(--brand)_4%),var(--cb-bg-surface))]",
        "shadow-[12px_0_44px_color-mix(in_srgb,var(--cb-bg-page)_70%,transparent)]",
        className
      )}
    >
      {children}
    </aside>
  );
}

export interface SidebarHeaderProps {
  logo?: React.ReactNode;
  onSearch?: () => void;
}

function SidebarHeader({ logo, onSearch }: SidebarHeaderProps) {
  return (
    <div className="shrink-0 px-4 pb-3 pt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-cb-hover">
          {logo ?? (
            <>
              <div className="relative h-7 w-7 shrink-0" aria-hidden>
                <div className="absolute left-1 top-1 h-5 w-2 rotate-45 rounded-sm bg-[var(--cb-text-primary)]" />
                <div className="absolute right-1 top-1 h-5 w-2 -rotate-45 rounded-sm bg-[linear-gradient(180deg,var(--brand),var(--accent-violet))]" />
              </div>
              <span className="truncate text-base font-bold text-cb-primary">CloudBlocks</span>
            </>
          )}
        </div>

        {onSearch && (
          <button
            onClick={onSearch}
            className="flex h-8 w-8 items-center justify-center rounded-md text-cb-muted transition-colors hover:bg-cb-hover hover:text-cb-primary"
            title="Search"
            type="button"
          >
            <SearchIcon />
          </button>
        )}
      </div>
    </div>
  );
}

function SidebarActions({ children }: { children: React.ReactNode }) {
  return <div className="flex shrink-0 flex-col gap-2 px-4 pb-4">{children}</div>;
}

function SidebarNav({ children, className }: React.HTMLAttributes<HTMLElement>) {
  return <nav className={cn("flex-1 overflow-y-auto px-4 py-1", className)}>{children}</nav>;
}

function SidebarNavSection({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      {label && (
        <p className="px-3 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-cb-muted">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

export interface SidebarNavItemProps {
  href?: string;
  icon?: React.ReactNode;
  active?: boolean;
  badge?: string | number;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

function SidebarNavItem({ href, icon, active, badge, onClick, children, className }: SidebarNavItemProps) {
  const Tag = href ? "a" : "button";

  return (
    <Tag
      href={href}
      type={href ? undefined : "button"}
      onClick={onClick}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5",
        "text-sm font-semibold transition-[background-color,border-color,color,transform] duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
        active
          ? "border-[var(--brand-border)] bg-[linear-gradient(135deg,var(--brand-subtle),color-mix(in_srgb,var(--accent-violet)_12%,transparent))] text-cb-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          : "border-transparent text-cb-secondary hover:bg-cb-hover hover:text-cb-primary hover:translate-x-0.5",
        className
      )}
    >
      {icon && (
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center",
            active ? "text-[var(--brand)] opacity-100" : "opacity-70"
          )}
        >
          {icon}
        </span>
      )}
      <span className="flex-1 truncate text-left">{children}</span>
      {badge !== undefined && (
        <span className="ml-auto rounded-full border border-cb bg-cb-elevated px-1.5 py-0.5 font-mono text-2xs text-cb-muted">
          {badge}
        </span>
      )}
    </Tag>
  );
}

export interface SidebarFooterProps {
  plan?: {
    name: string;
    stats: Array<{
      icon: React.ReactNode;
      label: string;
      sub: string;
      value: number;
      max: number;
    }>;
  };
  onUpgrade?: () => void;
  upgradeLabel?: string;
}

function SidebarFooter({ plan, onUpgrade, upgradeLabel }: SidebarFooterProps) {
  return (
    <div className="shrink-0 border-t border-cb p-4">
      <div className="mb-3 flex flex-col gap-0.5">
        <SidebarNavItem icon={<InfoIcon />}>Learn</SidebarNavItem>
        <SidebarNavItem icon={<DocIcon />}>Documentation</SidebarNavItem>
      </div>

      {plan && (
        <div className="mb-3 rounded-lg border border-cb bg-cb-elevated p-3 shadow-cb-sm">
          <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-cb-muted">{plan.name}</p>
          <div className="flex flex-col gap-2.5">
            {plan.stats.map((stat, i) => (
              <div key={`${stat.label}-${i}`} className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-cb-muted">{stat.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-2xs font-medium leading-none text-cb-primary">{stat.label}</p>
                  <p className="mt-0.5 truncate font-mono text-[10px] text-cb-muted">{stat.sub}</p>
                </div>
                <Progress
                  value={stat.value}
                  max={stat.max}
                  variant={stat.max > 0 && stat.value / stat.max > 0.8 ? "danger" : "brand"}
                  className="w-12 shrink-0"
                />
              </div>
            ))}
          </div>
          {onUpgrade && (
            <Button variant="primary" size="sm" fullWidth className="mt-3" onClick={onUpgrade}>
              {upgradeLabel ?? "Upgrade"}
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button className="text-2xs text-cb-muted transition-colors hover:text-cb-secondary" type="button">
          Install CLI
        </button>
        <span className="text-[10px] text-cb-disabled">/</span>
        <button className="text-2xs text-cb-muted transition-colors hover:text-cb-secondary" type="button">
          Changelog
        </button>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="7" cy="7" r="5" />
      <path d="M12 12l2.5 2.5" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7v5M8 5v.5" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
      <path d="M6 6h4M6 9h3" />
    </svg>
  );
}

export {
  Sidebar,
  SidebarHeader,
  SidebarActions,
  SidebarNav,
  SidebarNavSection,
  SidebarNavItem,
  SidebarFooter,
};
