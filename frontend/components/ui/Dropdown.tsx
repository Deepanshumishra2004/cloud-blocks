"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { cn } from "@/lib/cn";

interface DropdownContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}

const DropdownContext = React.createContext<DropdownContextValue>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
});

function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
      <div ref={containerRef} className="relative inline-block">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

function DropdownMenuTrigger({ children }: { children: React.ReactNode }) {
  const { open, setOpen, triggerRef } = React.useContext(DropdownContext);
  return (
    <div ref={triggerRef} onClick={() => setOpen(!open)} className="cursor-pointer">
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
  const { open, triggerRef } = React.useContext(DropdownContext);
  const [coords, setCoords] = React.useState<React.CSSProperties>({});
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => { setMounted(true); }, []);

  React.useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    const style: React.CSSProperties = { top: rect.bottom + 4 };
    if (align === "end") {
      style.right = window.innerWidth - rect.right;
    } else if (align === "start") {
      style.left = rect.left;
    } else {
      style.left = rect.left + rect.width / 2;
      style.transform = "translateX(-50%)";
    }
    setCoords(style);
  }, [open, align, triggerRef]);

  if (!open || !mounted) return null;

  return ReactDOM.createPortal(
    <div
      style={{ position: "fixed", zIndex: 9999, minWidth: 180, ...coords }}
      className={cn(
        "bg-cb-surface border border-cb rounded-lg shadow-cb-lg",
        "p-1",
        "animate-in fade-in-0 zoom-in-95",
        className
      )}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
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
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
        variant === "default"
          ? "text-cb-secondary hover:bg-cb-hover hover:text-cb-primary"
          : "text-(--danger) hover:bg-(--danger-subtle) hover:border-(--danger-border)",
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
    <div className={cn("px-3 py-1.5 text-2xs font-semibold text-cb-muted uppercase tracking-wider", className)}>
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
