"use client";

import { useRequireAuth } from "@/hooks/useAuth";
import { useRepls } from "@/hooks/useRepls";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { QuickStartSection } from "@/components/dashboard/QuickStartSection";
import { RecentReplsSection } from "@/components/dashboard/RecentReplsSection";

export default function DashboardHome() {
  const { user } = useRequireAuth();
  const { repls, loading, error, startRepl } = useRepls();

  const runningRepls = repls.filter((repl) => repl.status === "RUNNING").length;
  const stoppedRepls = repls.filter((repl) => repl.status === "STOPPED").length;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-8">
      <DashboardHeader username={user?.username} />

      <DashboardStats
        loading={loading}
        total={repls.length}
        running={runningRepls}
        stopped={stoppedRepls}
      />

      <RecentReplsSection repls={repls} loading={loading} error={error} onStart={startRepl} />

      <QuickStartSection />
    </div>
  );
}
