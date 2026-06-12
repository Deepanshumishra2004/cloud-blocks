"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cb-page px-6 text-center">
      <h2 className="text-lg font-semibold text-cb-primary">Something went wrong</h2>
      <p className="max-w-md text-sm text-cb-muted">
        The page hit an unexpected error. Try refreshing once.
      </p>
      <button
        onClick={reset}
        className="rounded-md border border-cb bg-cb-surface px-4 py-2 text-sm text-cb-primary transition hover:bg-cb-surface/80"
      >
        Try again
      </button>
    </div>
  );
}
