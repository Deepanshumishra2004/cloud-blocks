import type { Repl } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/Dropdown";
import { cn } from "@/lib/cn";
import { DotsIcon, EditIcon, OpenIcon, RuntimeIcon, StopIcon, TrashIcon } from "./icons";

export function ReplRow({
  repl,
  isLast,
  onOpen,
  onStart,
  onStop,
  onRename,
  onDelete,
}: {
  repl: Repl;
  isLast: boolean;
  onOpen: () => void;
  onStart: () => void;
  onStop: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const isRunning = repl.status === "RUNNING";

  

  return (
    <div
      className={cn(
        "flex items-center gap-4 px-4 py-3.5 group hover:bg-[var(--cb-bg-hover)] transition-colors",
        !isLast && "border-b border-cb"
      )}
    >
      <div className="w-9 h-9 shrink-0 rounded-lg bg-[var(--cb-bg-elevated)] border border-cb flex items-center justify-center text-base group-hover:border-cb-strong transition-colors text-cb-muted">
        <RuntimeIcon type={repl.type} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-cb-primary truncate">{repl.name}</p>
        <p className="text-2xs font-mono text-cb-muted mt-0.5">{repl.type}</p>
      </div>

      <Badge variant={isRunning ? "success" : "default"} dot={isRunning}>
        {isRunning ? "Running" : "Stopped"}
      </Badge>

      <Button
        variant={isRunning ? "primary" : "secondary"}
        size="sm"
        onClick={isRunning ? onOpen : onStart}
        className="shrink-0 min-w-[60px]"
      >
        {isRunning ? "Open" : "Start"}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="ghost" size="icon-sm" aria-label="More options">
            <DotsIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isRunning && (
            <DropdownMenuItem icon={<OpenIcon />} onSelect={onOpen}>
              Open editor
            </DropdownMenuItem>
          )}
          <DropdownMenuItem icon={<EditIcon />} onSelect={onRename}>
            Rename
          </DropdownMenuItem>
          {isRunning && (
            <DropdownMenuItem icon={<StopIcon />} onSelect={onStop}>
              Stop
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem icon={<TrashIcon />} variant="danger" onSelect={onDelete}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
