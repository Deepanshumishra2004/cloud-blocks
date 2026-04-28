import { useState } from "react";
import { cn } from "@/lib/cn";
import type { FileNode } from "./_lib/types";
import {
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
} from "./icons";

export function FileTreeNode({
  node,
  depth,
  activeFile,
  onSelect,
}: {
  node: FileNode;
  depth: number;
  activeFile: string | null;
  onSelect: (path: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const isActive = node.path === activeFile;

  if (node.type === "dir") {
    return (
      <div>
        <button
          onClick={() => setOpen((prev) => !prev)}
          style={{ paddingLeft: 8 + depth * 14 }}
          className="w-full flex items-center gap-1.5 h-7 pr-2 text-left hover:bg-white/5 transition-colors group"
        >
          <span className="text-white/25 text-xs transition-transform duration-100">
            <ChevronRightIcon open={open} />
          </span>
          <FolderIcon />
          <span className="text-xs text-white/60 truncate group-hover:text-white/80 transition-colors">
            {node.name}
          </span>
        </button>
        {open &&
          node.children?.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              onSelect={onSelect}
            />
          ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      style={{ paddingLeft: 8 + depth * 14 }}
      className={cn(
        "w-full flex items-center gap-1.5 h-7 pr-2 text-left transition-colors",
        isActive
          ? "bg-[var(--brand)]/15 text-white border-r-2 border-[var(--brand)]"
          : "text-white/50 hover:bg-white/5 hover:text-white/80",
      )}
    >
      <FileIcon ext={node.name.split(".").pop() ?? ""} />
      <span className="text-xs truncate font-mono">{node.name}</span>
    </button>
  );
}
