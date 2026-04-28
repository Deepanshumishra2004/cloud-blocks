import * as React from "react";
import { cn } from "@/lib/cn";
import { Badge, BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/Dropdown";

export type ReplType = "BUN" | "JAVASCRIPT" | "NODE" | "REACT" | "NEXT";
export type ReplStatus = "RUNNING" | "STOPPED";

export interface Repl {
  id: string;
  name: string;
  type: ReplType;
  status: ReplStatus;
  lastActive?: string;
}

export interface ReplItemProps {
  repl: Repl;
  onOpen?: () => void;
  onStop?: () => void;
  onStart?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  className?: string;
}

const typeIcon: Record<ReplType, string> = {
  BUN: "B",
  JAVASCRIPT: "JS",
  NODE: "[]",
  REACT: "R",
  NEXT: "N",
};

const statusBadge: Record<ReplStatus, { variant: BadgeVariant; label: string; dot: boolean }> = {
  RUNNING: { variant: "success", label: "Running", dot: true },
  STOPPED: { variant: "default", label: "Stopped", dot: false },
};

function ReplItem({
  repl,
  onOpen,
  onStop,
  onStart,
  onRename,
  onDelete,
  className,
}: ReplItemProps) {
  const { name, type, status, lastActive } = repl;
  const isRunning = status === "RUNNING";
  const badge = statusBadge[status];

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3",
        "border-b border-cb last:border-b-0",
        "hover:bg-cb-hover transition-colors duration-100",
        "cursor-pointer group",
        className,
      )}
    >
      <div
        className={cn(
          "w-9 h-9 shrink-0 rounded-lg",
          "bg-cb-elevated border border-cb",
          "flex items-center justify-center text-base font-mono",
          "transition-colors duration-100",
          "group-hover:border-cb-strong",
        )}
      >
        {typeIcon[type]}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-cb-primary truncate">{name}</p>
        <p className="text-2xs font-mono text-cb-muted mt-0.5">
          {type}
          {lastActive && (
            <>
              <span className="mx-1 text-cb-disabled">.</span>
              {isRunning ? "Active" : `Last active ${lastActive}`}
            </>
          )}
        </p>
      </div>

      <Badge variant={badge.variant} dot={badge.dot}>
        {badge.label}
      </Badge>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={isRunning ? onOpen : onStart}
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
                Open Editor
              </DropdownMenuItem>
            )}
            <DropdownMenuItem icon={<EditIcon />} onSelect={onRename}>
              Rename
            </DropdownMenuItem>
            {isRunning && (
              <DropdownMenuItem icon={<StopIcon />} onSelect={onStop}>
                Stop Repl
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="danger" icon={<TrashIcon />} onSelect={onDelete}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

const icon = (path: string) => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d={path} />
  </svg>
);

const DotsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
    <circle cx="3" cy="7" r="1.2" />
    <circle cx="7" cy="7" r="1.2" />
    <circle cx="11" cy="7" r="1.2" />
  </svg>
);

const OpenIcon = () => icon("M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9M9 1h6v6M8 8L14 2");
const EditIcon = () => icon("M11 2l3 3-9 9-4 1 1-4 9-9z");
const StopIcon = () => icon("M4 4h8v8H4z");
const TrashIcon = () => icon("M3 4h10M5 4V2h6v2M6 7v5M10 7v5M4 4l1 10h6l1-10");

export { ReplItem };
