"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/hooks/useAuth";
import { useRepls } from "@/hooks/useRepls";
import { StatCard } from "@/components/dashboard/StatCard";
import { RecentReplsSection } from "@/components/dashboard/RecentReplsSection";
import { CodeIcon, PlayIcon, StopIcon, StarIcon, PlusIcon } from "@/components/dashboard/icons";
import { getGreeting } from "@/components/dashboard/constants";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function DashboardHome() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useRequireAuth();
  const { repls, loading, error, startRepl } = useRepls();

  const stats = useMemo(() => {
    const running = repls.filter((r) => r.status === "RUNNING").length;
    const starting = repls.filter((r) => r.status === "STARTING").length;
    const cutoff = Date.now() - WEEK_MS;
    const newThisWeek = repls.filter((r) => new Date(r.createdAt).getTime() >= cutoff).length;
    return {
      total: repls.length,
      running,
      stopped: repls.length - running - starting,
      newThisWeek,
    };
  }, [repls]);

  async function handleStart(id: string) {
    const repl = repls.find((r) => r.id === id);
    try {
      await startRepl(id);
      toast.info("Starting repl", `${repl?.name ?? "Workspace"} is warming up.`);
    } catch (startError: unknown) {
      const message = startError instanceof Error ? startError.message : "Please try again.";
      toast.error("Failed to start", message);
    }
  }

  const newRepl = () => router.push("/dashboard/repls?new=1");

  return (
    <div className="dashboard-shell flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-cb-primary">
            {getGreeting()}{user?.username ? `, ${user.username}` : ""}
          </h1>
          <p className="mt-1 text-sm text-cb-muted">
            {loading
              ? "Loading your workspaces…"
              : stats.total === 0
                ? "Create your first cloud workspace to get started."
                : `${stats.running} running / ${stats.total} ${stats.total === 1 ? "workspace" : "workspaces"} total.`}
          </p>
        </div>
        <Button variant="primary" size="md" rightIcon={<PlusIcon />} onClick={newRepl}>
          New repl
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total repls"
          value={loading ? null : stats.total}
          subtitle="in your account"
          icon={<CodeIcon />}
          accentClass="text-[var(--brand)]"
        />
        <StatCard
          label="Running"
          value={loading ? null : stats.running}
          subtitle="active right now"
          icon={<PlayIcon />}
          accentClass="text-[var(--success)]"
        />
        <StatCard
          label="Stopped"
          value={loading ? null : stats.stopped}
          subtitle="ready to start"
          icon={<StopIcon />}
          accentClass="text-cb-muted"
        />
        <StatCard
          label="New this week"
          value={loading ? null : stats.newThisWeek}
          subtitle="created in last 7 days"
          icon={<StarIcon />}
          accentClass="text-[var(--info)]"
        />
      </div>

      <RecentReplsSection repls={repls} loading={loading} error={error} onStart={handleStart} />
    </div>
  );
}
