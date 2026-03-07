"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import { Progress } from "@/components/ui/Misc";
import { Button } from "@/components/ui/Button";

/* ============================================================
   SIDEBAR LAYOUT COMPONENTS

   Usage:
     <Sidebar>
       <SidebarHeader />
       <SidebarNav>
         <SidebarNavItem href="/dashboard" icon={<HomeIcon />} active>Home</SidebarNavItem>
       </SidebarNav>
       <SidebarFooter />
     </Sidebar>
   ============================================================ */

/* ── Sidebar Root ── */
function Sidebar({ className, children }: React.HTMLAttributes<HTMLElement>) {
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 bottom-0 z-50",
        "w-[228px] flex flex-col",
        "bg-cb-surface border-r border-cb",
        "overflow-y-auto",
        className
      )}
    >
      {children}
    </aside>
  );
}

/* ── Sidebar Header ── */
export interface SidebarHeaderProps {
  logo?: React.ReactNode;
  onSearch?: () => void;
}

function SidebarHeader({ logo, onSearch }: SidebarHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-cb shrink-0">
      <div className="flex items-center gap-2 px-1 py-1 rounded-md hover:bg-cb-hover transition-colors cursor-pointer">
        {logo ?? (
          <>
            <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center font-mono text-sm font-bold text-[#111] shrink-0">
              CB
            </div>
            <span className="font-mono text-sm font-bold text-cb-primary tracking-tight">
              cloudblocks
            </span>
          </>
        )}
        <span className="text-cb-muted text-[10px] ml-0.5">▾</span>
      </div>
      {onSearch && (
        <button
          onClick={onSearch}
          className="w-7 h-7 flex items-center justify-center rounded-md text-cb-muted hover:text-cb-primary hover:bg-cb-hover transition-colors"
          title="Search (Ctrl K)"
        >
          <SearchIcon />
        </button>
      )}
    </div>
  );
}

/* ── Sidebar Actions ── */
function SidebarActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 p-3 shrink-0">
      {children}
    </div>
  );
}

/* ── Sidebar Nav ── */
function SidebarNav({ children, className }: React.HTMLAttributes<HTMLElement>) {
  return (
    <nav className={cn("flex-1 px-3 py-2 overflow-y-auto", className)}>
      {children}
    </nav>
  );
}

/* ── Nav Section Label ── */
function SidebarNavSection({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1">
      {label && (
        <p className="text-2xs font-semibold text-cb-muted uppercase tracking-wider px-2 pt-3 pb-1">
          {label}
        </p>
      )}
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

/* ── Nav Item ── */
export interface SidebarNavItemProps {
  href?: string;
  icon?: React.ReactNode;
  active?: boolean;
  badge?: string | number;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

function SidebarNavItem({
  href,
  icon,
  active,
  badge,
  onClick,
  children,
  className,
}: SidebarNavItemProps) {
  const Tag = href ? "a" : "button";

  return (
    <Tag
      href={href}
      type={href ? undefined : "button"}
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-2 py-2 rounded-md",
        "text-sm font-medium border border-transparent",
        "cursor-pointer transition-colors duration-100",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand",
        "relative",
        active
          ? [
              "bg-cb-active text-cb-primary",
              "nav-item-active-bar",
            ]
          : "text-cb-secondary hover:bg-cb-hover hover:text-cb-primary",
        className
      )}
    >
      {icon && (
        <span className={cn("shrink-0 w-4 h-4 flex items-center justify-center", active ? "opacity-100" : "opacity-60")}>
          {icon}
        </span>
      )}
      <span className="flex-1 text-left truncate">{children}</span>
      {badge !== undefined && (
        <span className="font-mono text-2xs px-1.5 py-0.5 rounded-full bg-cb-elevated text-cb-muted border border-cb ml-auto">
          {badge}
        </span>
      )}
    </Tag>
  );
}

/* ── Sidebar Footer ── */
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
    <div className="shrink-0 p-3 border-t border-cb">
      {/* Footer nav links */}
      <div className="flex flex-col gap-0.5 mb-3">
        <SidebarNavItem icon={<InfoIcon />}>Learn</SidebarNavItem>
        <SidebarNavItem icon={<DocIcon />}>Documentation</SidebarNavItem>
      </div>

      {/* Plan card */}
      {plan && (
        <div className="bg-cb-elevated border border-cb rounded-lg p-3 mb-3">
          <p className="text-2xs font-semibold text-cb-muted uppercase tracking-wider mb-2">
            {plan.name}
          </p>
          <div className="flex flex-col gap-2.5">
            {plan.stats.map((stat, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-cb-muted shrink-0 text-sm">{stat.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-2xs font-medium text-cb-primary leading-none">
                    {stat.label}
                  </p>
                  <p className="text-[10px] font-mono text-cb-muted mt-0.5">
                    {stat.sub}
                  </p>
                </div>
                <Progress
                  value={stat.value}
                  max={stat.max}
                  variant={stat.value / stat.max > 0.8 ? "danger" : "brand"}
                  className="w-12 shrink-0"
                />
              </div>
            ))}
          </div>
          {onUpgrade && (
            <Button
              variant="primary"
              size="sm"
              fullWidth
              className="mt-3"
              onClick={onUpgrade}
              leftIcon={<span>✦</span>}
            >
              {upgradeLabel ?? "Upgrade"}
            </Button>
          )}
        </div>
      )}

      {/* Bottom links */}
      <div className="flex items-center gap-2">
        <button className="text-2xs text-cb-muted hover:text-cb-secondary transition-colors">
          Install CLI
        </button>
        <span className="text-cb-disabled text-[10px]">·</span>
        <button className="text-2xs text-cb-muted hover:text-cb-secondary transition-colors">
          Changelog
        </button>
      </div>
    </div>
  );
}

/* ── Icons ── */
function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="7" cy="7" r="5"/>
      <path d="M12 12l2.5 2.5"/>
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="8" cy="8" r="6"/>
      <path d="M8 7v5M8 5v.5"/>
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 2h8a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z"/>
      <path d="M6 6h4M6 9h3"/>
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
