// src/components/auth/AuthHeader.tsx
import Link from "next/link";

export function AuthHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-7">
      {/* Logo */}
      <Link href="/" className="inline-flex items-center gap-2.5 mb-6 group">
        <div className="w-7 h-7 bg-brand rounded-md flex items-center justify-center">
          <span className="font-mono font-bold text-xs text-[#111]">CB</span>
        </div>
        <span className="font-mono font-bold text-sm text-cb-primary">
          cloudblocks
        </span>
      </Link>

      <h1 className="text-2xl font-bold text-cb-primary tracking-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1.5 text-sm text-cb-secondary">{subtitle}</p>
      )}
    </div>
  );
}