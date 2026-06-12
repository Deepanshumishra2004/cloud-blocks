import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const STACK_ICONS = ["JS", "TS", "Bun"];
const TRUSTED_LOGOS = ["API", "CLI", "AI", "DB", "Git", "Edge", "Web", "Ops"];

export function FeaturesSection() {
  return (
    <section id="features" className="relative px-4 py-24">
      <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-[760px] -translate-x-1/2 rounded-full bg-brand/6 blur-3xl" />
      <div className="landing-container">
        <h2 className="mx-auto max-w-3xl text-balance text-center text-[42px] font-bold leading-[1.04] text-cb-primary sm:text-[58px]">
          Build your app with the best tools in the universe
        </h2>

        <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-[410px_1fr]">
          <BentoCard
            title="CloudBlocks SDK"
            icon={<BlocksIcon />}
            className="min-h-[420px] overflow-hidden"
            media={<BlocksIllustration />}
          />

          <div className="grid gap-6">
            <BentoCard
              title="100+ production-ready templates"
              description="Use Bun, Node, React, Next.js, APIs, scheduled jobs, terminals, and live HTTPS previews without wiring infrastructure by hand."
              className="min-h-[124px]"
            />

            <div className="grid gap-6 md:grid-cols-2">
              <BentoCard
                title="Use JavaScript, TypeScript, Bun"
                description={
                  <>
                    Write code with a real terminal and the{" "}
                    <span className="text-brand">CloudBlocks runtime API</span>.
                  </>
                }
                footer={
                  <div className="flex h-32 items-center justify-center gap-9 border-t border-cb">
                    {STACK_ICONS.map((icon) => (
                      <span
                        key={icon}
                    className="motion-card grid h-14 w-14 place-items-center rounded-lg border border-brand/20 bg-brand/10 font-mono text-sm font-bold text-cb-primary shadow-[0_12px_32px_rgba(20,152,255,0.08)] hover:text-brand"
                      >
                        {icon}
                      </span>
                    ))}
                  </div>
                }
              />
              <BentoCard
                title="Native sandboxes recommended for teams"
                description="Every repl runs isolated with gVisor-backed execution, idle shutdown, snapshots, and auditable project ownership."
              />
            </div>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 gap-6 lg:grid-cols-[410px_1fr_300px]">
          <BentoCard
            title="Developer experience"
            icon={<TerminalIcon />}
            className="min-h-[420px] overflow-hidden"
            media={<WorkspaceIllustration />}
          />

          <div className="grid gap-6">
            <SplitCard
              title="Develop on your device"
              description="Start on your laptop, continue in the browser, and share the same live app URL with your team."
              media={<PhonePanel />}
            />
            <SplitCard
              title="Inspect your bundle"
              description="Profile files, logs, terminal output, and runtime health from one workspace."
              media={<BundlePanel />}
            />
          </div>

          <BentoCard
            title="Launch with a click"
            description={
              <>
                Start sandboxes and deploy previews without opening Docker,
                Kubernetes, or cloud consoles with{" "}
                <span className="text-brand">CloudBlocks Launch</span>.
              </>
            }
            media={<LaunchPanel />}
          />
        </div>

        <div className="mt-24 grid grid-cols-1 gap-6 lg:grid-cols-[410px_300px_1fr]">
          <BentoCard
            title="Community"
            icon={<ChatIcon />}
            className="min-h-[420px] overflow-hidden"
            media={<OrbitIllustration />}
          />
          <BentoCard
            media={<CommunityMark />}
            title="50,000+ developer sessions"
            description={
              <>
                See what other builders are launching, ask questions, and get
                inspired in the <span className="text-brand">CloudBlocks community</span>.
              </>
            }
          />
          <div className="grid gap-6">
            <BentoCard
              title="80% faster environment setup"
              description="Teams skip local dependency drift, provision sandboxes instantly, and keep projects reproducible from first run."
              className="min-h-[196px]"
            />
            <BentoCard
              title="500,000+ projects created"
              description="From API demos to production dashboards, people use CloudBlocks to build, run, preview, and ship from the same place."
              className="min-h-[196px]"
            />
          </div>
        </div>

        <div className="mt-20 text-center">
          <p className="font-mono text-xs uppercase text-cb-muted">Trusted in production by</p>
          <div className="mx-auto mt-8 flex max-w-5xl flex-wrap items-center justify-center gap-5">
            {TRUSTED_LOGOS.map((logo) => (
              <span
                key={logo}
              className="motion-card shine-border grid h-16 w-16 place-items-center rounded-2xl border border-cb bg-[linear-gradient(180deg,#181818,#070707)] font-mono text-sm font-bold text-cb-primary shadow-[0_14px_46px_rgba(0,0,0,0.62)] hover:border-brand/50 hover:text-brand"
              >
                {logo}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BentoCard({
  title,
  description,
  icon,
  media,
  footer,
  className,
}: {
  title?: string;
  description?: ReactNode;
  icon?: ReactNode;
  media?: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <article className={cn("motion-card shine-border premium-panel border border-cb", className)}>
      {(title || icon) && (
        <div className="flex min-h-14 items-center gap-3 border-b border-cb px-6">
          {icon && <span className="motion-pulse">{icon}</span>}
          {title && <h3 className="font-mono text-sm font-bold text-cb-primary">{title}</h3>}
        </div>
      )}
      {media}
      {description && (
        <div className="px-6 py-5">
          <p className="font-mono text-sm leading-6 text-cb-secondary">{description}</p>
        </div>
      )}
      {footer}
    </article>
  );
}

function SplitCard({
  title,
  description,
  media,
}: {
  title: string;
  description: ReactNode;
  media: ReactNode;
}) {
  return (
    <article className="motion-card shine-border premium-panel grid min-h-[198px] grid-cols-1 border border-cb md:grid-cols-[1fr_210px]">
      <div className="p-6">
        <h3 className="font-mono text-sm font-bold text-cb-primary">{title}</h3>
        <p className="mt-3 font-mono text-sm leading-6 text-cb-secondary">{description}</p>
      </div>
      <div className="min-h-[170px] border-t border-cb md:border-l md:border-t-0">{media}</div>
    </article>
  );
}

function BlocksIllustration() {
  const items = ["api", "web", "job", "db", "ai", "git", "log", "run"];
  return (
    <div className="theme-visual-dark relative h-[360px] overflow-hidden">
      <div className="absolute inset-0 opacity-30 landing-dot-grid" />
      <div className="absolute right-6 top-6 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1 font-mono text-[10px] text-brand">
        live stack
      </div>
      <div className="absolute left-[-30px] top-20 grid rotate-[-24deg] grid-cols-4 gap-4">
        {items.map((item, index) => (
          <div
            key={item}
            className="grid h-28 w-32 place-items-center border border-white/[0.18] bg-[linear-gradient(145deg,#222,#0c0c0c)] shadow-[14px_18px_0_#080808,0_0_30px_rgba(20,152,255,0.08)]"
            style={{ transform: `translateY(${(index % 2) * 26}px)` }}
          >
            <span className="font-mono text-lg font-bold text-white/70">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkspaceIllustration() {
  return (
    <div className="theme-workspace-visual relative h-[360px] overflow-hidden">
      <div className="absolute inset-0 opacity-25 landing-dot-grid" />
      <span className="motion-pulse absolute right-12 top-14 h-2 w-2 rounded-full bg-brand" />
      <div className="absolute left-16 top-24 h-40 w-56 -skew-y-6 border border-white/[0.16] bg-black shadow-[22px_22px_0_#1c1c1c]">
        <div className="mx-auto mt-6 h-24 w-40 border border-white/[0.18] bg-[#050505]" />
        <div className="mx-auto mt-4 grid w-44 grid-cols-10 gap-1">
          {Array.from({ length: 40 }).map((_, index) => (
            <span key={index} className="h-1.5 rounded-sm bg-white/15" />
          ))}
        </div>
      </div>
      <div className="absolute bottom-12 right-14 h-28 w-24 rotate-12 border border-white/[0.14] bg-black p-3">
        <span className="mb-2 block h-2 w-12 bg-brand/45" />
        <span className="mb-2 block h-2 w-16 bg-white/[0.18]" />
        <span className="block h-2 w-10 bg-white/[0.18]" />
      </div>
    </div>
  );
}

function OrbitIllustration() {
  return (
    <div className="theme-visual-dark relative h-[360px] overflow-hidden">
      <div className="absolute inset-0 opacity-25 landing-dot-grid" />
      {[360, 260, 150].map((size) => (
        <span
          key={size}
          className="absolute rounded-full border border-white/[0.18]"
          style={{ height: size, width: size, left: 48 - size / 8, top: 36 + size / 10 }}
        />
      ))}
      {[
        [66, 85],
        [156, 128],
        [270, 90],
        [304, 224],
        [168, 254],
        [226, 178],
        [105, 238],
      ].map(([left, top], index) => (
        <span
          key={`${left}-${top}`}
          className="absolute h-6 w-6 rounded-full border border-white/40 bg-white/75 shadow-[0_0_18px_rgba(255,255,255,0.45)]"
          style={{ left, top, opacity: 0.95 - index * 0.07 }}
        />
      ))}
    </div>
  );
}

function PhonePanel() {
  return (
    <div className="flex h-full items-start justify-center overflow-hidden bg-[#151515] pt-0">
      <div className="shine-border h-48 w-28 rounded-b-[24px] border-x-[6px] border-b-[6px] border-black bg-white p-2 text-[6px] text-black">
        {["Connected to", "Rebuild", "Open preview", "Toggle terminal", "Open logs", "Fast refresh"].map((line) => (
          <div key={line} className="mb-2 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-black/50" />
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function BundlePanel() {
  return (
    <div className="h-full bg-[radial-gradient(circle_at_80%_0%,rgba(74,151,231,0.18),transparent_30%),#101418] p-4">
      <div className="mb-3 h-4 rounded bg-white/[0.08]" />
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 18 }).map((_, index) => (
          <span
            key={index}
            className="h-7 rounded-sm"
            style={{ background: index % 3 === 0 ? "#273247" : index % 3 === 1 ? "#202a3a" : "#35314a" }}
          />
        ))}
      </div>
    </div>
  );
}

function LaunchPanel() {
  return (
    <div className="border-b border-cb bg-cb-elevated px-12 py-8">
      <div className="shine-border rounded-md border border-white/10 bg-[#282828] p-5 shadow-xl">
        <div className="mb-4 flex items-center gap-2 text-xs text-white/75">
          <span className="motion-pulse h-3 w-3 rounded-sm border border-white/40" />
          Launching app
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white">
          <span className="block h-full w-2/3 bg-[#4b8dff]" />
        </div>
        <p className="mt-3 text-[10px] text-white/45">Opening cloud runtime...</p>
      </div>
    </div>
  );
}

function CommunityMark() {
  return (
    <div className="flex h-28 items-center justify-center border-b border-cb">
      <div className="relative h-16 w-20 rounded-t-[28px] bg-white/75">
        <span className="absolute left-5 top-6 h-3 w-3 rounded-full bg-black" />
        <span className="absolute right-5 top-6 h-3 w-3 rounded-full bg-black" />
        <span className="absolute bottom-[-8px] left-4 h-5 w-8 rotate-12 bg-white/75" />
      </div>
    </div>
  );
}

function BlocksIcon() {
  return <IconPath d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />;
}

function TerminalIcon() {
  return <IconPath d="m4 7 4 4-4 4m7 1h7" />;
}

function ChatIcon() {
  return <IconPath d="M5 6h14v9H9l-4 4V6Z" />;
}

function IconPath({ d }: { d: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cb-primary" aria-hidden>
      <path d={d} />
    </svg>
  );
}
