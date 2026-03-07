"use client";
// src/components/auth/OAuthButtons.tsx
import { useState } from "react";
import { cn } from "@/lib/cn";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type Provider = "google" | "github" | null;

export function OAuthButtons({ label = "Continue" }: { label?: string }) {
  const [loading, setLoading] = useState<Provider>(null);

  function redirect(provider: Provider) {
    if (loading) return; // prevent double-click
    setLoading(provider);
    // Small delay so the loading state renders before navigation
    setTimeout(() => {
      window.location.href = `${API}/api/v1/user/${provider}`;
    }, 120);
  }

  return (
    <div className="flex flex-col gap-2.5">
      <OAuthButton
        onClick={() => redirect("google")}
        loading={loading === "google"}
        disabled={loading !== null}
        icon={<GoogleIcon />}
        label={`${label} with Google`}
        loadingLabel="Redirecting to Google…"
      />
      <OAuthButton
        onClick={() => redirect("github")}
        loading={loading === "github"}
        disabled={loading !== null}
        icon={<GitHubIcon />}
        label={`${label} with GitHub`}
        loadingLabel="Redirecting to GitHub…"
      />
    </div>
  );
}

/* ── Single OAuth button ── */
interface OAuthButtonProps {
  onClick:      () => void;
  loading:      boolean;
  disabled:     boolean;
  icon:         React.ReactNode;
  label:        string;
  loadingLabel: string;
}

function OAuthButton({
  onClick, loading, disabled, icon, label, loadingLabel,
}: OAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // base
        "relative flex items-center justify-center gap-3",
        "w-full h-10 px-4 rounded-md",
        "border text-sm font-medium",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]",
        "select-none",
        // idle
        !disabled && "bg-cb-elevated border-cb text-cb-primary hover:bg-cb-hover hover:border-cb-strong active:scale-[0.99]",
        // loading (this button)
        loading && "bg-cb-elevated border-[var(--brand)] text-cb-primary cursor-wait",
        // disabled (other button loading)
        disabled && !loading && "bg-cb-elevated border-cb text-cb-disabled cursor-not-allowed opacity-50",
      )}
    >
      {/* Left icon or spinner */}
      <span className="shrink-0 w-4 h-4 flex items-center justify-center">
        {loading ? <Spinner /> : icon}
      </span>

      {/* Label */}
      <span>{loading ? loadingLabel : label}</span>

      {/* Right pulse dot when loading */}
      {loading && (
        <span className="absolute right-3 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--brand)] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--brand)]" />
        </span>
      )}
    </button>
  );
}

/* ── Spinner ── */
function Spinner() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"
        strokeDasharray="28" strokeDashoffset="10" strokeLinecap="round" opacity="0.3" />
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5"
        strokeDasharray="8" strokeLinecap="round" />
    </svg>
  );
}

/* ── Brand icons ── */
function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2A10 10 0 002 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/>
    </svg>
  );
}