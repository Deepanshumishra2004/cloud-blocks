"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/* ============================================================
   TOAST NOTIFICATION SYSTEM

   Usage:
     1. Wrap app in <ToastProvider>
     2. const { toast } = useToast()
     3. toast.success("Repl started!")
        toast.error("Failed to start", "Check your config")
        toast.info("Idle shutdown in 2min")
   ============================================================ */

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: {
    success: (title: string, description?: string, duration?: number) => void;
    error:   (title: string, description?: string, duration?: number) => void;
    warning: (title: string, description?: string, duration?: number) => void;
    info:    (title: string, description?: string, duration?: number) => void;
  };
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const add = (toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...toast, id }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.duration ?? 4000);
  };

  const dismiss = (id: string) =>
    setToasts(prev => prev.filter(t => t.id !== id));

  const toast = {
    success: (title: string, description?: string, duration?: number) =>
      add({ variant: "success", title, description, duration }),
    error: (title: string, description?: string, duration?: number) =>
      add({ variant: "error", title, description, duration }),
    warning: (title: string, description?: string, duration?: number) =>
      add({ variant: "warning", title, description, duration }),
    info: (title: string, description?: string, duration?: number) =>
      add({ variant: "info", title, description, duration }),
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToastRegion toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside <ToastProvider>");
  return ctx;
}

/* ── Toast Region ── */
const variantConfig: Record<ToastVariant, { icon: string; bar: string }> = {
  success: { icon: "✓", bar: "bg-[var(--success)]" },
  error:   { icon: "✕", bar: "bg-[var(--danger)]" },
  warning: { icon: "⚠", bar: "bg-[var(--warning)]" },
  info:    { icon: "ℹ", bar: "bg-[var(--info)]" },
};

function ToastRegion({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: string) => void }) {
  return (
    <div
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const cfg = variantConfig[t.variant];

  return (
    <div
      className={cn(
        "pointer-events-auto",
        "w-[340px] flex gap-3 overflow-hidden",
        "bg-cb-surface border border-cb rounded-lg shadow-cb-lg",
        "animate-in slide-in-from-bottom-2 fade-in-0 duration-200"
      )}
    >
      {/* Color bar */}
      <div className={cn("w-1 shrink-0", cfg.bar)} />

      {/* Content */}
      <div className="flex-1 py-3 pr-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <span className="font-mono text-sm shrink-0 mt-0.5">{cfg.icon}</span>
            <div>
              <p className="text-sm font-semibold text-cb-primary leading-snug">
                {t.title}
              </p>
              {t.description && (
                <p className="text-xs text-cb-muted mt-0.5">{t.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="shrink-0 text-cb-muted hover:text-cb-primary transition-colors text-sm mt-0.5"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}