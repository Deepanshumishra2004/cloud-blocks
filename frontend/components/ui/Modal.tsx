"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/* ============================================================
   MODAL / DIALOG
   Usage:
     const [open, setOpen] = useState(false)

     <Modal open={open} onClose={() => setOpen(false)} title="Create Repl">
       <ModalBody>
         <FormField label="Name"><Input /></FormField>
       </ModalBody>
       <ModalFooter>
         <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
         <Button variant="primary">Create</Button>
       </ModalFooter>
     </Modal>
   ============================================================ */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  children: React.ReactNode;
}

const modalSizes = {
  sm:  "max-w-sm",
  md:  "max-w-md",
  lg:  "max-w-lg",
  xl:  "max-w-2xl",
};

function Modal({
  open,
  onClose,
  onSubmit,
  title,
  description,
  size = "md",
  className,
  children,
}: ModalProps) {
  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "modal-title" : undefined}
        onSubmit={onSubmit}
        className={cn(
          "relative z-10 w-full",
          "bg-cb-surface border border-cb rounded-xl shadow-cb-lg",
          "flex flex-col max-h-[90vh]",
          modalSizes[size],
          className
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-cb shrink-0">
            <div>
              {title && (
                <h2
                  id="modal-title"
                  className="text-base font-semibold text-cb-primary leading-snug"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-xs text-cb-muted mt-1">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "shrink-0 w-7 h-7 flex items-center justify-center rounded-md",
                "text-cb-muted hover:text-cb-primary hover:bg-cb-hover",
                "transition-colors duration-100",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
              )}
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto flex-1">{children}</div>
      </form>
    </div>
  );
}

function ModalBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 py-5", className)} {...props} />;
}

function ModalFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2",
        "px-6 py-4 border-t border-cb bg-cb-elevated rounded-b-xl shrink-0",
        className
      )}
      {...props}
    />
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M1 1l12 12M13 1L1 13"/>
    </svg>
  );
}

export { Modal, ModalBody, ModalFooter };
