import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { FileNode } from "./_lib/types";
import { ChevronRightIcon, FileIcon, FolderIcon, TrashIcon } from "./icons";

export function FileTreeNode({
  node,
  depth,
  activeFile,
  onSelect,
  onDelete,
  onRename,
}: {
  node: FileNode;
  depth: number;
  activeFile: string | null;
  onSelect: (path: string) => void;
  onDelete?: (path: string) => void;
  onRename?: (oldPath: string, newPath: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const isActive = node.path === activeFile;

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== node.name && onRename) {
      const newPath = node.path.replace(/[^/]+$/, trimmed);
      onRename(node.path, newPath);
    }
    setRenaming(false);
  };

  if (node.type === "dir") {
    return (
      <div>
        <button
          onClick={() => setOpen((prev) => !prev)}
          style={{ paddingLeft: 8 + depth * 14 }}
          className="w-full flex items-center gap-1.5 h-7 pr-2 text-left hover:bg-white/5 transition-colors group"
        >
          <span className="text-white/25 text-xs">
            <ChevronRightIcon open={open} />
          </span>
          <FolderIcon />
          <span className="text-xs text-white/60 truncate group-hover:text-white/80 transition-colors flex-1">
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
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
      </div>
    );
  }

  if (renaming) {
    return (
      <div style={{ paddingLeft: 8 + depth * 14 }} className="pr-2 py-0.5">
        <input
          ref={inputRef}
          autoFocus
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") { setRenaming(false); setRenameValue(node.name); }
          }}
          className="w-full bg-white/10 text-white text-xs px-1.5 py-0.5 rounded border border-white/20 outline-none font-mono"
        />
      </div>
    );
  }

  return (
    <div
      style={{ paddingLeft: 8 + depth * 14 }}
      className={cn(
        "w-full flex items-center gap-1.5 h-7 pr-1 transition-colors group",
        isActive ? "bg-[var(--brand)]/15 border-r-2 border-[var(--brand)]" : "hover:bg-white/5",
      )}
    >
      <button
        onClick={() => onSelect(node.path)}
        onDoubleClick={() => { setRenaming(true); setRenameValue(node.name); }}
        className={cn("flex-1 flex items-center gap-1.5 text-left min-w-0", isActive ? "text-white" : "text-white/50 group-hover:text-white/80")}
      >
        <FileIcon ext={node.name.split(".").pop() ?? ""} />
        <span className="text-xs truncate font-mono">{node.name}</span>
      </button>
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(node.path); }}
          className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-400 transition-all shrink-0 p-0.5 rounded"
          title="Delete file"
        >
          <TrashIcon />
        </button>
      )}
    </div>
  );
}
