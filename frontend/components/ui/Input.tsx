import * as React from "react";
import { cn } from "@/lib/cn";

/* ============================================================
   INPUT
   ============================================================ */
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error, leftIcon, rightIcon, className, ...props }, ref) => {
    if (leftIcon || rightIcon) {
      return (
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="absolute left-3 text-cb-muted pointer-events-none text-sm">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            className={cn(
              "w-full h-9 rounded-md border bg-[var(--cb-input-bg)]",
              "text-sm text-cb-primary font-sans",
              "border-cb placeholder:text-cb-muted",
              "transition-[border-color,box-shadow] duration-100",
              "outline-none",
              "focus:border-brand focus:ring-2 focus:ring-[var(--brand-subtle)]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error && "border-[var(--danger)] focus:ring-[var(--danger-subtle)]",
              leftIcon  ? "pl-9"  : "pl-3",
              rightIcon ? "pr-9"  : "pr-3",
              className
            )}
            {...props}
          />
          {rightIcon && (
            <span className="absolute right-3 text-cb-muted pointer-events-none text-sm">
              {rightIcon}
            </span>
          )}
        </div>
      );
    }

    return (
      <input
        ref={ref}
        className={cn(
          "w-full h-9 px-3 rounded-md border bg-[var(--cb-input-bg)]",
          "text-sm text-cb-primary font-sans",
          "border-cb placeholder:text-cb-muted",
          "transition-[border-color,box-shadow] duration-100",
          "outline-none",
          "focus:border-brand focus:ring-2 focus:ring-[var(--brand-subtle)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-[var(--danger)] focus:ring-[var(--danger-subtle)]",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

/* ============================================================
   TEXTAREA
   ============================================================ */
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full px-3 py-2 rounded-md border bg-[var(--cb-input-bg)]",
        "text-sm text-cb-primary font-sans",
        "border-cb placeholder:text-cb-muted",
        "resize-vertical min-h-[80px] leading-relaxed",
        "transition-[border-color,box-shadow] duration-100",
        "outline-none",
        "focus:border-brand focus:ring-2 focus:ring-[var(--brand-subtle)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        error && "border-[var(--danger)] focus:ring-[var(--danger-subtle)]",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

/* ============================================================
   SELECT
   ============================================================ */
export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ error, className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "w-full h-9 pl-3 pr-8 rounded-md border bg-[var(--cb-input-bg)]",
          "text-sm text-cb-primary font-sans",
          "border-cb appearance-none cursor-pointer",
          "transition-[border-color,box-shadow] duration-100",
          "outline-none",
          "focus:border-brand focus:ring-2 focus:ring-[var(--brand-subtle)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error && "border-[var(--danger)]",
          className
        )}
        {...props}
      >
        {children}
      </select>
      {/* Chevron */}
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-cb-muted">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M6 8.5L1.5 4h9L6 8.5z"/>
        </svg>
      </span>
    </div>
  )
);
Select.displayName = "Select";

/* ============================================================
   FORM FIELD WRAPPER
   Usage:
     <FormField label="Email" hint="We'll never share your email" error="Invalid email">
       <Input type="email" error={!!error} />
     </FormField>
   ============================================================ */
export interface FormFieldProps {
  label?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

function FormField({
  label,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && (
        <label className="text-xs font-medium text-cb-secondary">
          {label}
          {required && <span className="text-[var(--danger)] ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-2xs text-[var(--danger)]">{error}</p>
      ) : hint ? (
        <p className="text-2xs text-cb-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export { Input, Textarea, Select, FormField };