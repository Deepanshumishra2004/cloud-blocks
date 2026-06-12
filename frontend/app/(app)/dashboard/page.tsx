"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Misc";
import { useToast } from "@/components/ui/Toast";
import { RuntimeIcon } from "@/components/repl/icons";
import { useRequireAuth } from "@/hooks/useAuth";
import { useRepls } from "@/hooks/useRepls";
import type { Repl } from "@/lib/api";

const resourceCards = [
  { label: "Featured", title: "Build fast inside isolated repl workspaces", icon: <LogoMark /> },
  { label: "Guide", title: "Create, run, and open your projects from one place", icon: <BookIcon /> },
  { label: "Changelog", title: "Runtime controls now share one clean dashboard flow", icon: <PulseIcon /> },
];

export default function DashboardHome() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useRequireAuth();
  const { repls, loading, error, startRepl } = useRepls();

  const stats = useMemo(() => {
    const running = repls.filter((repl) => repl.status === "RUNNING").length;
    const starting = repls.filter((repl) => repl.status === "STARTING").length;
    return { total: repls.length, running, starting, stopped: repls.length - running - starting };
  }, [repls]);

  const recent = repls.slice(0, 4);

  async function handleStart(repl: Repl) {
    try {
      await startRepl(repl.id);
      toast.info("Starting repl", `${repl.name} is warming up.`);
    } catch (startError: unknown) {
      const message = startError instanceof Error ? startError.message : "Please try again.";
      toast.error("Failed to start", message);
    }
  }

  return (
    <div className="dashboard-shell flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button className="dashboard-button-tab dashboard-button-tab-active" type="button">
            <FolderIcon />
            Projects
          </button>
          <button className="dashboard-button-tab" type="button">
            <ActivityIcon />
            Activity
          </button>
        </div>
        <Button variant="primary" size="md" rightIcon={<PlusIcon />} onClick={() => router.push("/dashboard/repls?new=1")}>
          New repl
        </Button>
      </div>

      <section className="dashboard-panel-strong p-4">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-cb-primary">Your workspace setup: {Math.min(stats.total, 5)}/5</p>
            <p className="mt-1 text-xs text-cb-muted">Welcome back{user?.username ? `, ${user.username}` : ""}. Keep your projects moving from here.</p>
          </div>
          <button className="text-cb-muted transition-colors hover:text-cb-primary" type="button" aria-label="Dismiss setup">
            <CloseIcon />
          </button>
        </div>
        <div className="mb-4 grid grid-cols-5 gap-2">
          {[0, 1, 2, 3, 4].map((step) => (
            <div
              key={step}
              className={step < Math.max(1, Math.min(stats.total, 5)) ? "h-1 rounded-full bg-[linear-gradient(90deg,var(--brand),var(--accent-violet))]" : "h-1 rounded-full bg-cb-elevated"}
            />
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-cb bg-cb-elevated px-4 py-4">
          <div className="flex items-center gap-4">
            <span className="pop-icon h-10 w-10">
              <FolderIcon />
            </span>
            <div>
              <p className="text-sm font-bold text-cb-primary">Create a repl</p>
              <p className="mt-0.5 text-sm text-cb-secondary">Start a new runtime workspace for your next idea.</p>
            </div>
          </div>
          <Button variant="primary" size="sm" rightIcon={<ArrowRightIcon />} onClick={() => router.push("/dashboard/repls?new=1")}>
            Create repl
          </Button>
        </div>
      </section>

      <section
        className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-lg border border-[var(--brand-border)] bg-[linear-gradient(135deg,var(--brand),var(--accent-violet),var(--accent-pink))] p-8 shadow-cb-md"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
        }}
      >
        <button
          className="group flex h-[288px] w-full max-w-[354px] flex-col overflow-hidden rounded-lg border border-black/20 bg-[var(--cb-bg-surface)] text-left shadow-cb-lg transition-transform hover:-translate-y-1"
          type="button"
          onClick={() => router.push("/dashboard/repls?new=1")}
        >
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8">
            <span className="flex h-20 w-20 items-center justify-center rounded-lg bg-[linear-gradient(135deg,var(--brand),var(--accent-violet))] text-white shadow-[0_18px_42px_color-mix(in_srgb,var(--brand)_32%,transparent)]">
              <PlusLargeIcon />
            </span>
            <span className="text-base font-bold text-cb-primary">New repl</span>
          </div>
          <div className="flex h-10 items-center justify-between border-t border-cb px-4 text-xs font-medium text-cb-secondary group-hover:text-cb-primary">
            <span>Create a new repl</span>
            <ArrowRightIcon />
          </div>
        </button>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {resourceCards.map((card) => (
          <button
            key={card.label}
            className="dashboard-panel flex min-h-[90px] flex-col justify-between p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[var(--brand-border)]"
            type="button"
          >
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase text-cb-muted">
              <span className="text-[var(--brand)]">{card.icon}</span>
              {card.label}
            </span>
            <span className="mt-4 text-sm font-bold text-cb-primary">{card.title}</span>
          </button>
        ))}
      </div>

      <section className="dashboard-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-cb px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-cb-primary">Recent repls</h2>
            <p className="mt-0.5 text-xs text-cb-muted">
              {loading ? "Loading workspaces..." : `${stats.total} total / ${stats.running} running`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/repls")}>
            View all
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-2 p-4">
            {[0, 1, 2].map((item) => <Skeleton key={item} height={58} />)}
          </div>
        ) : error ? (
          <p className="px-5 py-8 text-sm text-[var(--danger)]">{error}</p>
        ) : recent.length === 0 ? (
          <p className="px-5 py-8 text-sm text-cb-muted">No repls yet. Create one to see it here.</p>
        ) : (
          <div className="divide-y divide-cb-border">
            {recent.map((repl) => (
              <div key={repl.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                <span className="pop-icon h-10 w-10">
                  <RuntimeIcon type={repl.type} />
                </span>
                <div className="min-w-[180px] flex-1">
                  <p className="truncate text-sm font-semibold text-cb-primary">{repl.name}</p>
                  <p className="mt-0.5 font-mono text-2xs text-cb-muted">{repl.type}</p>
                </div>
                <Badge variant={repl.status === "RUNNING" ? "success" : "default"} dot={repl.status === "RUNNING"}>
                  {repl.status.toLowerCase()}
                </Badge>
                <Button
                  variant={repl.status === "RUNNING" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => (repl.status === "RUNNING" ? router.push(`/repl/${repl.id}`) : void handleStart(repl))}
                >
                  {repl.status === "RUNNING" ? "Open" : "Start"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FolderIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M1.5 4.5h5l1.2 1.4h6.8v6.6a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" /><path d="M1.5 4.5V3.2a1 1 0 0 1 1-1h3.2l1.1 1.3h6.7a1 1 0 0 1 1 1v1.4" /></svg>;
}
function ActivityIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M1.5 8h3l1.5-5 3.2 10 1.5-5h3.8" /></svg>;
}
function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 2v10M2 7h10" /></svg>;
}
function PlusLargeIcon() {
  return <svg width="38" height="38" viewBox="0 0 38 38" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 7v24M7 19h24" /></svg>;
}
function ArrowRightIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2.5 7h8.5M7.5 3.5 11 7l-3.5 3.5" /></svg>;
}
function CloseIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>;
}
function LogoMark() {
  return <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 15 8.6 3h2.8L18 15h-3.2L10 6.3 5.2 15z" fill="currentColor" /></svg>;
}
function BookIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2.5 3.5A2.5 2.5 0 0 1 5 1h8v12H5a2.5 2.5 0 0 0-2.5 2z" /><path d="M2.5 3.5V15" /></svg>;
}
function PulseIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M1.5 8h3l1.2-2.5L8 11l2.2-8 1.4 5h2.9" /></svg>;
}
