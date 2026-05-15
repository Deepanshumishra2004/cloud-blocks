"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardBody }   from "@/components/ui/Card";
import { Button }           from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Input";
import { Alert }            from "@/components/ui/Alert";
import { AuthHeader }       from "@/components/auth/AuthHeader";
import { requestPasswordReset } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState("");
  const [loading, setLoading] = useState(false);
  const [sent,    setSent]    = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await requestPasswordReset(email.trim().toLowerCase());
      setSent(true);
    } catch {
      // Backend always returns 200 — any error here is a network issue.
      setError("Could not send the reset request. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full shadow-cb-lg border-cb">
      <CardBody className="p-7">
        <AuthHeader
          title="Forgot your password?"
          subtitle="Enter your email and we'll send a reset link."
        />

        {error && (
          <Alert variant="danger" className="mb-5 text-sm">
            {error}
          </Alert>
        )}

        {sent ? (
          <div className="flex flex-col gap-4">
            <Alert variant="success" className="text-sm">
              If an account exists for that email, a reset link is on the way.
              Check your inbox (and spam folder).
            </Alert>
            <Link
              href="/signin"
              className="text-sm text-brand font-medium hover:underline text-center"
            >
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField label="Email address" required>
              <Input
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </FormField>

            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              loading={loading}
              className="mt-1"
            >
              Send reset link
            </Button>

            <p className="text-center text-sm text-cb-secondary mt-2">
              Remembered it?{" "}
              <Link href="/signin" className="text-brand font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </CardBody>
    </Card>
  );
}
