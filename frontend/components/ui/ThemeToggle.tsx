
"use client";
// src/components/ui/ThemeToggle.tsx
import { useTheme } from "@/components/layout/ThemeProvider";
import { cn } from "@/lib/cn";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { isDark, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative flex items-center gap-1.5",
        "h-8 w-[62px] px-1 rounded-full border",
        "bg-cb-elevated border-cb",
        "hover:border-cb-strong",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        className
      )}
    >
      {/* Track icons */}
      <MoonIcon
        className={cn(
          "absolute left-2 w-3.5 h-3.5 transition-all duration-200",
          isDark ? "opacity-100 text-brand" : "opacity-30 text-cb-muted"
        )}
      />
      <SunIcon
        className={cn(
          "absolute right-2 w-3.5 h-3.5 transition-all duration-200",
          !isDark ? "opacity-100 text-brand" : "opacity-30 text-cb-muted"
        )}
      />

      {/* Thumb */}
      <span
        className={cn(
          "absolute top-1/2 -translate-y-1/2",
          "w-6 h-6 rounded-full",
          "bg-cb-surface border border-cb shadow-cb-sm",
          "transition-transform duration-200 ease-in-out",
          isDark ? "translate-x-0" : "translate-x-[30px]"
        )}
      />
    </button>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}