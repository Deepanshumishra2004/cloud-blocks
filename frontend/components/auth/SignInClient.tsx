"use client";
// src/app/signin/page.tsx
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { AuthDivider } from "@/components/auth/AuthDivider";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { useAuthStore } from "@/lib/authstore";
import { isAxiosError } from "axios";
import api from "@/lib/api";

const OAUTH_ERRORS: Record<string, string> = {
  oauth_denied: "Sign-in was cancelled.",
  oauth_failed: "OAuth sign-in failed. Please try again.",
  email_not_verified: "Your Google email is not verified.",
};

export default function SignInClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const err = searchParams.get("error");

    if (err) {
      setError(OAUTH_ERRORS[err] ?? "An error occurred.");
      window.history.replaceState({}, "", "/signin");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/api/v1/user/signin", {
        email,
        password,
      });

      setAuth(data.user, null);
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(
        isAxiosError(err) ? err.response?.data?.message ?? "Sign in failed. Please try again." : "Sign in failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full shadow-cb-lg border-cb">
      <CardBody className="p-7">
        <AuthHeader title="Welcome back" subtitle="Sign in to continue building." />

        {error && (
          <Alert variant="danger" className="mb-5 text-sm">
            {error}
          </Alert>
        )}

        <OAuthButtons label="Sign in" />

        <AuthDivider />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="Email address" required>
            <Input
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<MailIcon />}
              required
            />
          </FormField>

          <FormField
            label="Password"
            required
            hint={
              <Link href="/auth/forgot-password" className="text-brand hover:underline text-2xs">
                Forgot password?
              </Link>
            }
          >
            <Input
              type={showPw ? "text" : "password"}
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<LockIcon />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="text-cb-muted hover:text-cb-secondary"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }
              required
            />
          </FormField>

          <Button type="submit" variant="primary" size="md" fullWidth loading={loading} className="mt-1">
            Sign In â†’
          </Button>
        </form>

        <p className="text-center text-sm text-cb-secondary mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-brand font-medium hover:underline">
            Sign up free
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}

function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M1.5 3.5l6.5 5.5 6.5-5.5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5.5a3 3 0 016 0V7" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2 2l12 12M6.5 6.6A3 3 0 0011 11M4.5 4.6C2.9 5.7 1.5 7.8 1.5 8s2.5 5 6.5 5c1.3 0 2.4-.4 3.3-1M9.5 3.1C9 3 8.5 3 8 3 4 3 1.5 8 1.5 8s.4.9 1.2 1.9" />
    </svg>
  );
}
