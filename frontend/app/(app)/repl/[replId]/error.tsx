"use client";

import { useEffect } from "react";

export default function ReplError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[repl] page error:", error);
  }, [error]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#0d0d0f] text-white">
      <p className="text-sm text-red-400">Something went wrong in the editor.</p>
      <button
        onClick={reset}
        className="rounded px-4 py-2 text-sm bg-[#1a1a1f] hover:bg-[#2a2a2f] border border-white/10"
      >
        Try again
      </button>
    </div>
  );
}
