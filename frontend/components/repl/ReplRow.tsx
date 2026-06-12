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
        "group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-cb-hover",
        !isLast && "border-b border-cb"
      )}
    >
      <div className="pop-icon h-10 w-10 shrink-0 text-base transition-colors group-hover:border-[var(--brand-border)]">
        <RuntimeIcon type={repl.type} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-semibold text-cb-primary">{repl.name}</p>
        <p className="text-2xs font-mono text-cb-muted mt-0.5">{repl.type}</p>
      </div>

      <Badge variant={isRunning ? "success" : "default"} dot={isRunning}>
        {isRunning ? "Running" : "Stopped"}
      </Badge>

      <Button
        variant={isRunning ? "primary" : "secondary"}
        size="sm"
        onClick={isRunning ? onOpen : onStart}
        className="min-w-[82px] shrink-0"
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
              Stop Pod
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
