import { Button } from "@/components/ui/Button";
import { PlusIcon } from "./icons";

export function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 border border-dashed border-cb rounded-xl text-center">
      <div className="w-12 h-12 rounded-xl bg-[var(--cb-bg-elevated)] border border-cb flex items-center justify-center text-cb-muted">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 7.5h16v9H4z" />
          <path d="M9 7.5V6a3 3 0 0 1 6 0v1.5" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-medium text-cb-primary">No repls yet</p>
        <p className="text-xs text-cb-muted mt-1">Create your first cloud environment.</p>
      </div>
      <Button variant="primary" size="sm" onClick={onNew} leftIcon={<PlusIcon />}>
        Create Repl
      </Button>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 border border-[var(--danger-border)] bg-[var(--danger-subtle)] rounded-xl text-center">
      <p className="text-sm text-[var(--danger)]">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
