import { CodeIcon, PlayIcon, StarIcon, StopIcon } from "./icons";
import { StatCard } from "./StatCard";

export function DashboardStats({
  loading,
  total,
  running,
  stopped,
}: {
  loading: boolean;
  total: number;
  running: number;
  stopped: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Repls"
        value={loading ? null : total}
        subtitle="in your account"
        icon={<CodeIcon />}
        accentClass="text-[var(--brand)]"
      />
      <StatCard
        label="Running"
        value={loading ? null : running}
        subtitle="active right now"
        icon={<PlayIcon />}
        accentClass="text-[var(--success)]"
      />
      <StatCard
        label="Stopped"
        value={loading ? null : stopped}
        subtitle="ready to start"
        icon={<StopIcon />}
        accentClass="text-cb-muted"
      />
      <StatCard
        label="Plan"
        value="Free"
        subtitle="0 / 3 repls used"
        icon={<StarIcon />}
        accentClass="text-[var(--info)]"
      />
    </div>
  );
}
