"use client";
// src/app/auth/callback/page.tsx
//
// Backend redirects here after OAuth with either:
//   /auth/callback                      ← success
//   /auth/callback?error=<code>         ← failure

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/authstore";
import { fetchUser } from "@/lib/api";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "You cancelled the sign-in.",
  oauth_failed: "OAuth sign-in failed. Please try again.",
  email_not_verified: "Your Google account email is not verified.",
};

function CallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);
  const error = searchParams.get("error");
  const next = searchParams.get("next") ?? "/dashboard";

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errMsg, setErrMsg] = useState("");
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    window.history.replaceState({}, "", "/callback");

    if (error) return;

    fetchUser()
      .then((user) => {
        if (!user) throw new Error("Missing authenticated user");

        setAuth(user, null);
        setStatus("success");
        router.replace(next);
      })
      .catch(() => {
        setErrMsg("Could not verify your account. The session may be missing or expired.");
        setStatus("error");
      });
  }, [error, next, router, setAuth]);

  const message = status === "success" ? "Welcome! Redirecting..." : "Verifying your account...";

  if (error) {
    const errorMessage = ERROR_MESSAGES[error] ?? "An unexpected error occurred.";

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
          <p className="text-sm text-cb-secondary mt-1">{errorMessage}</p>
        </div>
        <Link href="/signin" className="text-sm text-brand font-medium hover:underline">
          ← Back to sign in
        </Link>
      </div>
    );
  }

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
