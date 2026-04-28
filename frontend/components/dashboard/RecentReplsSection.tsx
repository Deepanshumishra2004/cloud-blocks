import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Misc";
import { cn } from "@/lib/cn";
import { REPL_TYPE_ICON_LABELS } from "./constants";
import { ReplTypeIcon } from "./icons";
import { Section } from "./Section";
import { Repl } from "@/lib/api";

export function RecentReplsSection({
  repls,
  loading,
  error,
  onStart,
}: {
  repls: Repl[];
  loading: boolean;
  error: string | null;
  onStart: (id: string) => void;
}) {
  const router = useRouter();
  const recentRepls = repls.slice(0, 5);

  return (
    <Section
      title="Recent Repls"
      action={
        <Link href="/dashboard/repls" className="text-xs text-cb-secondary hover:text-cb-primary transition-colors">
          View all -
        </Link>
      }
    >
      {loading ? (
        <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <Skeleton key={i} height={60} />)}</div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => window.location.reload()} />
      ) : recentRepls.length === 0 ? (
        <EmptyRepls onNew={() => router.push("/dashboard/repls?new=1")} />
      ) : (
        <div className="border border-cb rounded-xl overflow-hidden">
          {recentRepls.map((repl, index) => (
            <DashboardReplRow
              key={repl.id}
              repl={repl}
              isLast={index === recentRepls.length - 1}
              onOpen={() => router.push(`/repl/${repl.id}`)}
              onStart={() => onStart(repl.id)}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function DashboardReplRow({
  repl,
  isLast,
  onOpen,
  onStart,
}: {
  repl: Repl;
  isLast: boolean;
  onOpen: () => void;
  onStart: () => void;
}) {
  const isRunning = repl.status === "RUNNING";

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 bg-[var(--cb-bg-surface)] hover:bg-[var(--cb-bg-hover)] transition-colors cursor-pointer group",
        !isLast && "border-b border-cb"
      )}
    >
      <div className="w-8 h-8 rounded-lg bg-[var(--cb-bg-elevated)] border border-cb flex items-center justify-center text-sm shrink-0">
        <ReplTypeIcon type={repl.type} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-cb-primary truncate">{repl.name}</p>
        <p className="text-2xs font-mono text-cb-muted">{REPL_TYPE_ICON_LABELS[repl.type] ?? repl.type}</p>
      </div>

      <Badge variant={isRunning ? "success" : "default"} dot={isRunning}>
        {isRunning ? "Running" : "Stopped"}
      </Badge>

      <Button
        variant="secondary"
        size="sm"
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={isRunning ? onOpen : onStart}
      >
        {isRunning ? "Open" : "Start"}
      </Button>
    </div>
  );
}

function EmptyRepls({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 border border-dashed border-cb rounded-xl text-center">
      <div className="w-12 h-12 rounded-xl bg-[var(--cb-bg-elevated)] border border-cb flex items-center justify-center text-2xl">
        <ReplTypeIcon type="NODE" />
      </div>
      <div>
        <p className="text-sm font-medium text-cb-primary">No repls yet</p>
        <p className="text-xs text-cb-muted mt-1">Create your first cloud environment to get started.</p>
      </div>
      <Button variant="primary" size="sm" onClick={onNew}>
        Create Repl
      </Button>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 border border-[var(--danger-border)] bg-[var(--danger-subtle)] rounded-xl text-center">
      <p className="text-sm text-[var(--danger)]">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
