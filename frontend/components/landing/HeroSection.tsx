"use client";
// src/components/landing/HeroSection.tsx
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useEffect, useRef } from "react";

const TERMINAL_LINES = [
  { delay: 0,    color: "text-[var(--brand)]",   text: "$ cloudblocks create my-api" },
  { delay: 600,  color: "text-cb-secondary",      text: "  ✓ Provisioning gVisor sandbox..." },
  { delay: 1100, color: "text-cb-secondary",      text: "  ✓ Mounting S3 filesystem..." },
  { delay: 1600, color: "text-cb-secondary",      text: "  ✓ Starting Bun runtime..." },
  { delay: 2100, color: "text-[var(--success)]",  text: "  🚀 Ready → https://my-api.cloudblocks.dev" },
  { delay: 2700, color: "text-[var(--brand)]",    text: "$ bun run dev" },
  { delay: 3200, color: "text-cb-secondary",      text: "  Server running on :3000" },
  { delay: 3700, color: "text-cb-muted",          text: "  Watching for file changes..." },
];

export function HeroSection() {
  const containerRef = useRef<HTMLDivElement>(null);

  // Stagger fade-up on mount
  useEffect(() => {
    const els = containerRef.current?.querySelectorAll("[data-fadeup]");
    els?.forEach((el, i) => {
      const e = el as HTMLElement;
      e.style.opacity = "0";
      e.style.transform = "translateY(24px)";
      setTimeout(() => {
        e.style.transition = "opacity 0.55s ease, transform 0.55s ease";
        e.style.opacity = "1";
        e.style.transform = "translateY(0)";
      }, 120 + i * 100);
    });
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-20"
    >
      {/* Eyebrow badge */}
      <div data-fadeup className="mb-6">
        <Badge variant="brand" className="gap-1.5 px-3 py-1.5 text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse inline-block" />
          Now in public beta
        </Badge>
      </div>

      {/* Headline */}
      <h1
        data-fadeup
        className="font-sans font-bold text-5xl md:text-7xl text-cb-primary leading-[1.05] tracking-tight max-w-4xl"
      >
        Code runs{" "}
        <span className="relative inline-block">
          <span className="text-brand">instantly</span>
          <svg
            className="absolute -bottom-2 left-0 w-full opacity-40"
            viewBox="0 0 200 8"
            fill="none"
          >
            <path
              d="M2 6 C50 2, 100 2, 198 6"
              stroke="var(--brand)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </span>
        {" "}in the cloud.
      </h1>

      {/* Subheadline */}
      <p
        data-fadeup
        className="mt-6 text-lg md:text-xl text-cb-secondary max-w-xl leading-relaxed"
      >
        Sandboxed environments that spin up in under a second. Write code
        in your browser, share a live URL, deploy in one click.
      </p>

      {/* CTAs */}
      <div data-fadeup className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" size="lg" asChild>
          <Link href="/signup">Start for free →</Link>
        </Button>
        <Button variant="outline" size="lg" asChild>
          <Link href="#features">See how it works</Link>
        </Button>
      </div>

      {/* Social proof */}
      <p data-fadeup className="mt-5 text-xs text-cb-muted font-mono">
        No credit card required · Free tier always available
      </p>

      {/* Terminal card */}
      <div
        data-fadeup
        className="mt-16 w-full max-w-2xl bg-cb-surface border border-cb rounded-xl overflow-hidden shadow-cb-lg text-left"
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-cb bg-cb-elevated">
          <span className="w-3 h-3 rounded-full bg-[var(--danger)] opacity-80" />
          <span className="w-3 h-3 rounded-full bg-[var(--warning)] opacity-80" />
          <span className="w-3 h-3 rounded-full bg-[var(--success)] opacity-80" />
          <span className="ml-auto font-mono text-xs text-cb-muted">
            cloudblocks terminal
          </span>
        </div>
        {/* Lines */}
        <div className="p-5 font-mono text-sm leading-7 min-h-[200px]">
          {TERMINAL_LINES.map((line, i) => (
            <TermLine key={i} {...line} />
          ))}
          <BlinkCursor delay={4200} />
        </div>
      </div>

      {/* Scroll hint */}
      <div data-fadeup className="mt-16 flex flex-col items-center gap-2 opacity-40">
        <span className="text-xs font-mono text-cb-muted">scroll</span>
        <div className="w-px h-8 bg-gradient-to-b from-cb-border to-transparent" />
      </div>
    </section>
  );
}

/* ── Terminal line with delayed reveal ── */
function TermLine({
  text, color, delay,
}: {
  text: string; color: string; delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    const t = setTimeout(() => {
      el.style.transition = "opacity 0.3s ease";
      el.style.opacity = "1";
    }, delay + 800);  // +800 for hero stagger
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div ref={ref} className={`${color} whitespace-pre`}>
      {text}
    </div>
  );
}

function BlinkCursor({ delay }: { delay: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    const t = setTimeout(() => { el.style.opacity = "1"; }, delay + 800);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div className="text-brand font-mono">
      <span ref={ref}>
        $ <span className="inline-block w-2 h-4 bg-brand align-middle animate-pulse" />
      </span>
    </div>
  );
}