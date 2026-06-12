"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error("[app] global error:", error);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0d0d0f] px-6 text-center text-white">
        <h2 className="text-lg font-semibold">Application error</h2>
        <p className="max-w-md text-sm text-white/70">
          The app failed to render a required screen. Try again.
        </p>
        <button
          onClick={reset}
          className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
        >
          Reload
        </button>
      </body>
    </html>
  );
}
