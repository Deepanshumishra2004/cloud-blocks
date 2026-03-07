"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/* ============================================================
   DROPDOWN MENU
   Lightweight implementation. For accessibility in production
   consider using @radix-ui/react-dropdown-menu.

   Usage:
     <DropdownMenu>
       <DropdownMenuTrigger>
         <Button size="icon-sm" variant="ghost">⋯</Button>
       </DropdownMenuTrigger>
       <DropdownMenuContent align="end">
         <DropdownMenuItem onSelect={() => rename()}>Rename</DropdownMenuItem>
         <DropdownMenuSeparator />
         <DropdownMenuItem variant="danger" onSelect={() => delete()}>Delete</DropdownMenuItem>
       </DropdownMenuContent>
     </DropdownMenu>
   ============================================================ */

interface DropdownContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
}
const DropdownContext = React.createContext<DropdownContextValue>({
  open: false,
  setOpen: () => {},
});

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  // close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen }}>
      <div ref={ref} className="relative inline-block">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

function DropdownMenuTrigger({ children }: { children: React.ReactNode }) {
  const { open, setOpen } = React.useContext(DropdownContext);
  return (
    <div onClick={() => setOpen(!open)} className="cursor-pointer">
      {children}
    </div>
  );
}

export interface DropdownMenuContentProps {
  align?: "start" | "end" | "center";
  className?: string;
  children: React.ReactNode;
}

function DropdownMenuContent({ align = "end", className, children }: DropdownMenuContentProps) {
  const { open } = React.useContext(DropdownContext);
  if (!open) return null;

  const alignClass = {
    start:  "left-0",
    end:    "right-0",
    center: "left-1/2 -translate-x-1/2",
  }[align];

  return (
    <div
      className={cn(
        "absolute top-full mt-1 z-50 min-w-[180px]",
        "bg-cb-surface border border-cb rounded-lg shadow-cb-lg",
        "p-1 py-1",
        "animate-in fade-in-0 zoom-in-95",
        alignClass,
        className
      )}
    >
      {children}
    </div>
  );
}

export interface DropdownMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "danger";
  icon?: React.ReactNode;
  onSelect?: () => void;
}

function DropdownMenuItem({
  variant = "default",
  icon,
  onSelect,
  className,
  children,
  ...props
}: DropdownMenuItemProps) {
  const { setOpen } = React.useContext(DropdownContext);

  return (
    <button
      type="button"
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2",
        "text-sm rounded-md border border-transparent",
        "transition-colors duration-100 cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand",
        variant === "default"
          ? "text-cb-secondary hover:bg-cb-hover hover:text-cb-primary"
          : "text-[var(--danger)] hover:bg-[var(--danger-subtle)] hover:border-[var(--danger-border)]",
        className
      )}
      onClick={() => {
        onSelect?.();
        setOpen(false);
      }}
      {...props}
    >
      {icon && <span className="shrink-0 text-[14px] opacity-70">{icon}</span>}
      {children}
    </button>
  );
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={cn("h-px bg-cb-border my-1 -mx-1", className)} />;
}

function DropdownMenuLabel({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "px-3 py-1.5 text-2xs font-semibold text-cb-muted uppercase tracking-wider",
        className
      )}
    >
      {children}
    </div>
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
};