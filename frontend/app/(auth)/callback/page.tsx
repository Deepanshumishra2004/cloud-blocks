"use client";
// src/app/auth/callback/page.tsx
//
// Backend redirects here after OAuth with either:
//   /auth/callback?token=<jwt>          ← success
//   /auth/callback?error=<code>         ← failure
//
// SECURITY: Token is stripped from the URL immediately on mount,
// before any async work, so it never sits in browser history.

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/authstore";
import api, { fetchUser } from "@/lib/api";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied:       "You cancelled the sign-in.",
  oauth_failed:       "OAuth sign-in failed. Please try again.",
  email_not_verified: "Your Google account email is not verified.",
};

// ── Inner component ───────────────────────────────────────────
function CallbackInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const setAuth      = useAuthStore((s) => s.setAuth);

  const [status,  setStatus]  = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Signing you in…");
  const [errMsg,  setErrMsg]  = useState("");

  // Ref prevents the effect from firing twice in React Strict Mode
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    // Read params synchronously before any await
    const token = searchParams.get("token");
    const error = searchParams.get("error");
    const next  = searchParams.get("next") ?? "/dashboard";

    // ── Strip token from URL immediately (security) ───────────
    // Do this BEFORE any async work so the JWT never stays in history
    window.history.replaceState({}, "", "/callback");

    // ── Handle error redirect from backend ────────────────────
    if (error) {
      setErrMsg(ERROR_MESSAGES[error] ?? "An unexpected error occurred.");
      setStatus("error");
      return;
    }

    // ── No token in URL ───────────────────────────────────────
    if (!token) {
      setErrMsg("No authentication token received. Please try signing in again.");
      setStatus("error");
      return;
    }

    // ── Valid token: verify it by fetching /me ─────────────────
    // We pass the token explicitly via header because the Zustand store
    // and cookie haven't been set yet at this point.
    setMessage("Verifying your account…");

    api
      .get<{ user: ReturnType<typeof Object.create> }>("/api/v1/user/me", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(({ data }) => {
        // Token is valid — persist to store + cookie
        setAuth(data.user, token);
        setStatus("success");
        setMessage("Welcome! Redirecting…");
        router.replace(next);
      })
      .catch(() => {
        setErrMsg("Could not verify your account. The link may have expired.");
        setStatus("error");
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Empty deps: we read searchParams synchronously at the start.
  // Adding searchParams would cause a double-run in dev.

  // ── Error UI ─────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--danger-subtle)] border border-[var(--danger-border)] flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--danger)" strokeWidth="1.8">
            <circle cx="10" cy="10" r="8" />
            <path d="M10 6v4M10 14h.01" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-cb-primary">Sign-in failed</p>
          <p className="text-sm text-cb-secondary mt-1">{errMsg}</p>
        </div>
        <Link href="/signin" className="text-sm text-brand font-medium hover:underline">
          ← Back to sign in
        </Link>
      </div>
    );
  }

  // ── Loading / success UI ──────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="w-12 h-12 rounded-full border-2 border-cb-border border-t-brand animate-spin" />
      <div>
        <p className="font-semibold text-cb-primary">Just a moment</p>
        <p className="text-sm text-cb-secondary mt-1">{message}</p>
      </div>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────
export default function CallbackPage() {
  return (
    <div className="min-h-screen bg-cb-page flex items-center justify-center p-5">
      <div className="w-full max-w-sm bg-cb-surface border border-cb rounded-xl p-10 shadow-cb-lg">
        <Suspense
          fallback={
            <div className="flex justify-center">
              <div className="w-10 h-10 rounded-full border-2 border-cb-border border-t-brand animate-spin" />
            </div>
          }
        >
          <CallbackInner />
        </Suspense>
      </div>
    </div>
  );
}