"use client";
// src/app/auth/signup/page.tsx
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardBody }    from "@/components/ui/Card";
import { Button }            from "@/components/ui/Button";
import { Input, FormField }  from "@/components/ui/Input";
import { Alert }             from "@/components/ui/Alert";
import { AuthHeader }        from "@/components/auth/AuthHeader";
import { AuthDivider }       from "@/components/auth/AuthDivider";
import { OAuthButtons }      from "@/components/auth/OAuthButtons";
import { useAuthStore }      from "@/lib/authstore";
import { isAxiosError }      from "axios";
import api                   from "@/lib/api";

interface FormState {
  email:    string;
  username: string;
  password: string;
}

interface FieldErrors {
  email?:    string;
  username?: string;
  password?: string;
}

export default function SignUpPage() {
  const router  = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [form,        setForm]        = useState<FormState>({ email: "", username: "", password: "" });
  const [showPw,      setShowPw]      = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error,       setError]       = useState("");
  const [loading,     setLoading]     = useState(false);

  function set(key: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      setFieldErrors((fe) => ({ ...fe, [key]: undefined }));
    };
  }

  function validate(): boolean {
    const errs: FieldErrors = {};
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errs.email = "Enter a valid email address";
    }
    if (form.username.length < 3) {
      errs.username = "At least 3 characters";
    } else if (!/^[a-z0-9_]+$/.test(form.username)) {
      errs.username = "Only lowercase letters, numbers, underscores";
    }
    if (form.password.length < 8) {
      errs.password = "At least 8 characters";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!validate()) return;

    setLoading(true);
    try {
      const { data } = await api.post("/api/v1/user/signup", form);
      setAuth(data.user, null);
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg = isAxiosError(err)
        ? err.response?.data?.message ?? "Sign up failed. Please try again."
        : "Sign up failed. Please try again.";
      // Map backend field errors
      if (msg.includes("Email")) setFieldErrors((fe) => ({ ...fe, email: msg }));
      else if (msg.includes("Username")) setFieldErrors((fe) => ({ ...fe, username: msg }));
      else setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // Password strength
  const strength = passwordStrength(form.password);

  return (
    <Card className="w-full shadow-cb-lg border-cb">
      <CardBody className="p-7">
        <AuthHeader
          title="Create your account"
          subtitle="Free forever. No credit card required."
        />

        {error && (
          <Alert variant="danger" className="mb-5 text-sm">
            {error}
          </Alert>
        )}

        {/* OAuth */}
        <OAuthButtons label="Sign up" />

        <AuthDivider />

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField
            label="Email address"
            error={fieldErrors.email}
            required
          >
            <Input
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={form.email}
              onChange={set("email")}
              error={!!fieldErrors.email}
              leftIcon={<MailIcon />}
              required
            />
          </FormField>

          <FormField
            label="Username"
            error={fieldErrors.username}
            hint={!fieldErrors.username ? "Lowercase letters, numbers and underscores" : undefined}
            required
          >
            <Input
              type="text"
              placeholder="your-username"
              autoComplete="username"
              value={form.username}
              onChange={set("username")}
              error={!!fieldErrors.username}
              leftIcon={<AtIcon />}
              required
            />
          </FormField>

          <FormField
            label="Password"
            error={fieldErrors.password}
            required
          >
            <Input
              type={showPw ? "text" : "password"}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              value={form.password}
              onChange={set("password")}
              error={!!fieldErrors.password}
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
            {/* Strength bar */}
            {form.password.length > 0 && (
              <div className="flex gap-1 mt-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full transition-all duration-300"
                    style={{
                      background:
                        i < strength.score
                          ? strength.color
                          : "var(--cb-border-strong)",
                    }}
                  />
                ))}
                <span className="text-2xs font-mono ml-1" style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}
          </FormField>

          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            loading={loading}
            className="mt-1"
          >
            Create account →
          </Button>

          <p className="text-center text-2xs text-cb-muted leading-relaxed">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="text-cb-secondary hover:text-cb-primary underline underline-offset-2">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-cb-secondary hover:text-cb-primary underline underline-offset-2">
              Privacy Policy
            </Link>.
          </p>
        </form>

        <p className="text-center text-sm text-cb-secondary mt-5">
          Already have an account?{" "}
          <Link
            href="/signin"
            className="text-brand font-medium hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}

/* ── Password strength ── */
function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (pw.length === 0) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8)                    score++;
  if (pw.length >= 12)                   score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw))          score++;

  const levels = [
    { label: "Weak",   color: "var(--danger)"  },
    { label: "Fair",   color: "var(--warning)"  },
    { label: "Good",   color: "var(--info)"     },
    { label: "Strong", color: "var(--success)"  },
  ];
  const lvl = levels[Math.min(score - 1, 3)] ?? levels[0];
  return { score, ...lvl };
}

/* ── Icons ── */
function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M1.5 3.5l6.5 5.5 6.5-5.5" />
    </svg>
  );
}
function AtIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="8" cy="8" r="3" />
      <path d="M11 8c0 2.2 1 3 2 3 0-2.5 0-8-5-8a5 5 0 000 10c1.5 0 2.8-.6 3.7-1.5" />
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
