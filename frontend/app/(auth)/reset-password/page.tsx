"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardBody }   from "@/components/ui/Card";
import { Button }           from "@/components/ui/Button";
import { Input, FormField } from "@/components/ui/Input";
import { Alert }            from "@/components/ui/Alert";
import { AuthHeader }       from "@/components/auth/AuthHeader";
import { isAxiosError }     from "axios";
import { resetPassword }    from "@/lib/api";

function ResetInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const token        = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  if (!token) {
    return (
      <Card className="w-full shadow-cb-lg border-cb">
        <CardBody className="p-7">
          <AuthHeader title="Invalid reset link" />
          <Alert variant="danger" className="text-sm">
            This password reset link is missing its token. Request a new one
            from the forgot-password page.
          </Alert>
          <Link
            href="/forgot-password"
            className="mt-4 inline-block text-sm text-brand font-medium hover:underline"
          >
            ← Request a new link
          </Link>
        </CardBody>
      </Card>
    );
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(
        isAxiosError(err)
          ? err.response?.data?.message ?? "Reset failed. Try again."
          : "Reset failed. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full shadow-cb-lg border-cb">
      <CardBody className="p-7">
        <AuthHeader
          title="Set a new password"
          subtitle="Choose a password you haven't used before."
        />

        {error && (
          <Alert variant="danger" className="mb-5 text-sm">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FormField label="New password" required>
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </FormField>
          <FormField label="Confirm password" required>
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
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
            Reset password
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  );
}
