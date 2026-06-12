import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

const TECH_STACK: Array<{
  label: string;
  icon: ReactNode;
  bg: string;
  fg: string;
}> = [
  { label: "Bun", icon: <BunIcon />, bg: "#f8d9b5", fg: "#12100e" },
  { label: "React", icon: <ReactIcon />, bg: "#101827", fg: "#61dafb" },
  { label: "Node.js", icon: <NodeIcon />, bg: "#143b21", fg: "#79c56a" },
  { label: "JavaScript", icon: <JavaScriptIcon />, bg: "#f7df1e", fg: "#111111" },
  { label: "Next.js", icon: <NextIcon />, bg: "#ffffff", fg: "#050505" },
  { label: "Rust", icon: <RustIcon />, bg: "#f46623", fg: "#ffffff" },
  { label: "TypeScript", icon: <TypeScriptIcon />, bg: "#3178c6", fg: "#ffffff" },
  { label: "Docker", icon: <DockerIcon />, bg: "#2496ed", fg: "#ffffff" },
  { label: "Postgres", icon: <PostgresIcon />, bg: "#336791", fg: "#ffffff" },
  { label: "Redis", icon: <RedisIcon />, bg: "#dc382d", fg: "#ffffff" },
  { label: "Prisma", icon: <PrismaIcon />, bg: "#101828", fg: "#ffffff" },
  { label: "Tailwind", icon: <TailwindIcon />, bg: "#06b6d4", fg: "#00111a" },
];

export function HeroSection() {
  return (
    <section className="relative overflow-hidden px-4 pb-24 pt-32 sm:pt-40">
      <div className="pointer-events-none absolute left-[12%] top-28 h-2 w-2 rounded-full bg-brand/70 motion-pulse" />
      <div className="pointer-events-none absolute right-[18%] top-44 h-1.5 w-1.5 rounded-full bg-white/50 motion-pulse" />
      <div className="pointer-events-none absolute left-[20%] top-[520px] hidden h-24 w-px bg-gradient-to-b from-brand/50 to-transparent lg:block" />
      <div className="landing-container relative z-10 flex flex-col items-center text-center">
        <div className="animate-rise mb-7 inline-flex items-center gap-2 rounded-full border border-cb bg-cb-surface px-3 py-1.5 font-mono text-xs text-cb-secondary shine-border">
          <span className="h-1.5 w-1.5 rounded-full bg-brand motion-pulse" />
          Runtime ready in seconds
        </div>

        <h1 className="animate-rise-delay-1 max-w-4xl text-balance font-sans text-[48px] font-bold leading-[0.96] tracking-normal text-cb-primary sm:text-[72px] lg:text-[88px]">
          Everything you need to build cloud apps
        </h1>
        <p className="animate-rise-delay-2 mt-7 max-w-2xl text-balance text-lg leading-8 text-cb-secondary">
          CloudBlocks gives every project an instant sandbox, browser IDE,
          real terminal, live URL, snapshots, and deployment path in one
          polished workspace.
        </p>

        <div className="animate-rise-delay-3 mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="lg" asChild className="h-12 rounded-full px-7 font-bold">
            <Link href="/signup">Get started for free</Link>
          </Button>
          <Button variant="outline" size="lg" asChild className="h-12 rounded-full px-7">
            <Link href="#features">Read the docs</Link>
          </Button>
        </div>

        <div className="animate-rise-delay-3 mt-10 flex items-center justify-center gap-3 text-sm text-cb-secondary">
          <div className="flex -space-x-2">
            {["D", "A", "S"].map((label) => (
              <span
                key={label}
                className="grid h-7 w-7 place-items-center rounded-full border-2 border-black bg-cb-elevated text-xs font-bold text-cb-primary"
              >
                {label}
              </span>
            ))}
          </div>
          <span>
            Enterprise needs?{" "}
            <Link href="/contact" className="font-semibold text-cb-primary hover:text-white">
              Talk to our team
            </Link>
          </span>
        </div>
      </div>

      <div className="landing-container relative z-10 mt-20">
        <div className="animate-rise-delay-3 relative mx-auto h-[360px] max-w-6xl overflow-hidden rounded-[22px] border border-white/18 bg-[#8fcdf5] shadow-[0_42px_140px_rgba(0,0,0,0.85),0_0_90px_rgba(63,171,255,0.16)] sm:h-[460px]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.96),transparent_26%),radial-gradient(circle_at_80%_18%,rgba(151,119,255,0.38),transparent_25%),radial-gradient(circle_at_72%_84%,rgba(0,148,255,0.42),transparent_30%),linear-gradient(135deg,#ecf9ff_0%,#bfe9ff_28%,#74c0f5_62%,#4397e7_100%)]" />
          <div className="absolute inset-0 opacity-80 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.48)_17%,transparent_35%,rgba(88,178,255,0.42)_57%,transparent_76%)]" />
          <div className="absolute -left-24 bottom-10 h-56 w-56 rounded-full bg-cyan-300/40 blur-3xl" />
          <div className="absolute -right-16 top-12 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl" />
          <div className="absolute left-8 top-7 rounded-full border border-black/10 bg-white/35 px-3 py-1 font-mono text-[10px] font-bold text-black/55 backdrop-blur-sm">
            cloudblocks.dev/live
          </div>
          <div className="absolute bottom-8 right-[32%] hidden rounded-full border border-black/10 bg-white/40 px-3 py-1 font-mono text-[10px] font-bold text-black/55 backdrop-blur-sm md:block">
            snapshot saved
          </div>
          <div className="theme-terminal motion-float absolute left-[8%] top-[13%] h-[78%] w-[58%] overflow-hidden rounded-xl border border-black/20 shadow-2xl">
            <div className="flex h-9 items-center gap-2 border-b border-white/10 bg-[#181818] px-4">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              <span className="ml-5 h-5 flex-1 rounded bg-white/5" />
            </div>
            <div className="grid h-[calc(100%-36px)] grid-cols-[170px_1fr] text-left font-mono text-[11px]">
              <div className="border-r border-white/10 bg-[#151515] p-4 text-white/45">
                {["app", "api", "components", "lib", "public", "worker"].map((item) => (
                  <div key={item} className="mb-3 flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand/70" />
                    {item}
                  </div>
                ))}
              </div>
              <div className="p-5 leading-6 text-white/70">
                <CodeLine n="01" text="export default function Sandbox() {" />
                <CodeLine n="02" text="  const url = await cloudblocks.deploy();" hot />
                <CodeLine n="03" text="  return <Preview url={url} />;" />
                <CodeLine n="04" text="}" />
                <div className="shine-border mt-8 rounded-md border border-brand/25 bg-brand/10 p-4 text-brand typing-cursor">
                  running on https://atlas.cloudblocks.dev
                </div>
              </div>
            </div>
          </div>
          <div className="theme-device motion-float-slow absolute right-[8%] top-[9%] h-[86%] w-[22%] min-w-[160px] overflow-hidden rounded-[28px] border-[8px] border-black shadow-2xl">
            <div className="h-full bg-[#101317] p-4 text-left">
              <div className="mb-5 flex items-center justify-between text-[10px] font-bold text-white">
                <span>9:41</span>
                <span>5G</span>
              </div>
              <p className="text-center text-sm font-bold text-white">Preview</p>
              <div className="shine-border mt-5 h-32 rounded-xl bg-[linear-gradient(135deg,#2a3f61,#15171c)] p-3">
                <div className="loading-sweep mb-2 h-3 w-16 rounded bg-brand/80" />
                <div className="loading-sweep h-2 w-24 rounded bg-white/35" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <span className="preview-tile h-14 rounded-lg bg-white/[0.08]" />
                <span className="preview-tile h-14 rounded-lg bg-white/[0.08] [animation-delay:350ms]" />
                <span className="preview-tile h-14 rounded-lg bg-white/[0.08] [animation-delay:700ms]" />
                <span className="preview-tile h-14 rounded-lg bg-white/[0.08] [animation-delay:1050ms]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <TechIconRail />
    </section>
  );
}

function CodeLine({ n, text, hot }: { n: string; text: string; hot?: boolean }) {
  return (
    <div className="grid grid-cols-[32px_1fr] gap-3">
      <span className="text-white/[0.22]">{n}</span>
      <span className={hot ? "text-brand" : "text-white/65"}>{text}</span>
    </div>
  );
}

function TechIconRail() {
  const icons = [...TECH_STACK, ...TECH_STACK];

  return (
    <div className="landing-container relative z-10 mt-16">
      <div className="text-center font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-cb-muted">
        Built for modern stacks
      </div>
      <div className="tech-rail-mask mt-7 overflow-hidden">
        <div className="tech-rail-track flex items-center gap-7 py-2">
          {icons.map((item, index) => (
            <div
              key={`${item.label}-${index}`}
              className="tech-icon group grid h-20 w-20 shrink-0 place-items-center rounded-[22px] border border-white/10 text-xl font-black"
              style={{
                backgroundColor: item.bg,
                color: item.fg,
                animationDelay: `${(index % TECH_STACK.length) * 120}ms`,
              }}
              aria-label={item.label}
              title={item.label}
            >
              <span className="tech-icon-mark">{item.icon}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BunIcon() {
  return (
    <svg viewBox="0 0 64 64" className="tech-icon-svg" aria-hidden>
      <ellipse cx="32" cy="35" rx="24" ry="19" fill="currentColor" opacity="0.95" />
      <path d="M17 27c4-8 12-13 15-13s11 5 15 13" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <circle cx="24" cy="35" r="3" fill="currentColor" />
      <circle cx="40" cy="35" r="3" fill="currentColor" />
      <path d="M28 43c3 2 6 2 9 0" fill="none" stroke="#f8d9b5" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ReactIcon() {
  return (
    <svg viewBox="0 0 64 64" className="tech-icon-svg" aria-hidden>
      <circle cx="32" cy="32" r="5" fill="currentColor" />
      <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke="currentColor" strokeWidth="4" />
      <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke="currentColor" strokeWidth="4" transform="rotate(60 32 32)" />
      <ellipse cx="32" cy="32" rx="26" ry="10" fill="none" stroke="currentColor" strokeWidth="4" transform="rotate(120 32 32)" />
    </svg>
  );
}

function NodeIcon() {
  return (
    <svg viewBox="0 0 64 64" className="tech-icon-svg" aria-hidden>
      <path d="M32 5 55 18v28L32 59 9 46V18L32 5Z" fill="currentColor" opacity="0.95" />
      <path d="M24 42V23h6l9 11V23h6v19h-6l-9-11v11h-6Z" fill="#143b21" />
    </svg>
  );
}

function JavaScriptIcon() {
  return (
    <svg viewBox="0 0 64 64" className="tech-icon-svg" aria-hidden>
      <rect x="8" y="8" width="48" height="48" rx="6" fill="currentColor" opacity="0.1" />
      <text x="32" y="45" textAnchor="middle" fontSize="27" fontWeight="900" fill="currentColor" fontFamily="Arial, sans-serif">
        JS
      </text>
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 64 64" className="tech-icon-svg" aria-hidden>
      <circle cx="32" cy="32" r="25" fill="currentColor" />
      <path d="M21 44V20h5.4l17.8 26.6" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
      <path d="M43 20v24" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

function RustIcon() {
  return (
    <svg viewBox="0 0 64 64" className="tech-icon-svg" aria-hidden>
      <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="6" />
      <path d="M20 22h16c7 0 11 3 11 9 0 4-2 7-6 8l7 10h-10l-6-9h-4v9h-8V22Zm8 7v5h8c2 0 3-1 3-2.5S38 29 36 29h-8Z" fill="currentColor" />
      <path d="M32 4v8M32 52v8M4 32h8M52 32h8M12 12l6 6M46 46l6 6M12 52l6-6M46 18l6-6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function TypeScriptIcon() {
  return (
    <svg viewBox="0 0 64 64" className="tech-icon-svg" aria-hidden>
      <rect x="8" y="8" width="48" height="48" rx="6" fill="currentColor" opacity="0.14" />
      <text x="32" y="45" textAnchor="middle" fontSize="27" fontWeight="900" fill="currentColor" fontFamily="Arial, sans-serif">
        TS
      </text>
    </svg>
  );
}

function DockerIcon() {
  return (
    <svg viewBox="0 0 64 64" className="tech-icon-svg" aria-hidden>
      <path d="M11 34h42c-2 12-10 20-23 20-10 0-17-5-19-20Z" fill="currentColor" />
      <path d="M17 24h7v7h-7v-7Zm9 0h7v7h-7v-7Zm9 0h7v7h-7v-7Zm-9-9h7v7h-7v-7Zm9 9h7v7h-7v-7Zm9 0h7v7h-7v-7Z" fill="currentColor" />
      <path d="M48 28c3-3 6-3 9-1-1 4-4 6-9 6" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function PostgresIcon() {
  return (
    <svg viewBox="0 0 64 64" className="tech-icon-svg" aria-hidden>
      <path d="M33 6c13 0 21 7 21 19 0 9-5 15-12 17l-1 13-9-7-10 4 2-10C16 39 10 33 10 24 10 13 19 6 33 6Z" fill="currentColor" />
      <path d="M27 27c0-4 2-7 6-7s6 3 6 7-2 7-6 7-6-3-6-7Z" fill="#336791" />
      <path d="M40 42c-4 1-9 1-13-1" fill="none" stroke="#336791" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function RedisIcon() {
  return (
    <svg viewBox="0 0 64 64" className="tech-icon-svg" aria-hidden>
      <path d="M11 40 32 29l21 11-21 11-21-11Z" fill="currentColor" />
      <path d="M11 30 32 19l21 11-21 11-21-11Z" fill="currentColor" opacity="0.75" />
      <path d="M11 20 32 9l21 11-21 11-21-11Z" fill="currentColor" opacity="0.55" />
      <path d="M24 18h16M25 29h14M25 40h14" stroke="#dc382d" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function PrismaIcon() {
  return (
    <svg viewBox="0 0 64 64" className="tech-icon-svg" aria-hidden>
      <path d="M35 6 12 45c-1 2 0 4 2 5l29 8c2 .6 4-1.1 3.6-3.3L39 8c-.3-2.3-2.8-3.5-4-2Zm-2 15 5 26-15-4 10-22Z" fill="currentColor" />
    </svg>
  );
}

function TailwindIcon() {
  return (
    <svg viewBox="0 0 64 64" className="tech-icon-svg" aria-hidden>
      <path d="M32 18c-7 0-11 3.5-13 10 2.7-3.5 5.8-4.8 9.3-3.8 2 .6 3.4 2 5 3.5 2.6 2.6 5.7 5.6 12.7 5.6 7 0 11-3.5 13-10-2.7 3.5-5.8 4.8-9.3 3.8-2-.6-3.4-2-5-3.5C42 21 39 18 32 18Zm-14 13c-7 0-11 3.5-13 10 2.7-3.5 5.8-4.8 9.3-3.8 2 .6 3.4 2 5 3.5 2.6 2.6 5.7 5.6 12.7 5.6 7 0 11-3.5 13-10-2.7 3.5-5.8 4.8-9.3 3.8-2-.6-3.4-2-5-3.5C28 34 25 31 18 31Z" fill="currentColor" />
    </svg>
  );
}
