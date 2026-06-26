import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { FileNode } from "./_lib/types";
import { validateFilePath } from "./_lib/fileTree";
import { ChevronRightIcon, FileIcon, FolderIcon, TrashIcon } from "./icons";

type MenuItem = { label: string; onClick: () => void; danger?: boolean };

export function FileTreeNode({
  node,
  depth,
  activeFile,
  onSelect,
  onDelete,
  onRename,
  onNewFile,
}: {
  node: FileNode;
  depth: number;
  activeFile: string | null;
  onSelect: (path: string) => void;
  onDelete?: (path: string) => void;
  onRename?: (oldPath: string, newPath: string) => void;
  // Create a new file next to this node (parentDir is "" at the root).
  onNewFile?: (parentDir: string) => void;
}) {
  const [open, setOpen] = useState(depth === 0);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isActive = node.path === activeFile;

  const parentDir = node.path.includes("/") ? node.path.replace(/\/[^/]+$/, "") : "";

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [menu]);

  const cancelRename = () => {
    setRenaming(false);
    setRenameError(null);
    setRenameValue(node.name);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === node.name) {
      cancelRename();
      return;
    }
    // Validate just the new leaf name (renames stay in the same directory).
    const error = validateFilePath(trimmed);
    if (error) {
      setRenameError(error);
      return; // keep editing so the user can fix it
    }
    if (onRename) {
      const newPath = node.path.replace(/[^/]+$/, trimmed);
      onRename(node.path, newPath);
    }
    setRenaming(false);
    setRenameError(null);
  };

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY });
  };

  const menuItems: MenuItem[] = [
    // For a directory, "New file" creates inside it; otherwise alongside.
    ...(onNewFile ? [{ label: "New file…", onClick: () => onNewFile(node.type === "dir" ? node.path : parentDir) }] : []),
    ...(onRename ? [{ label: "Rename", onClick: () => { setRenaming(true); setRenameValue(node.name); } }] : []),
    { label: "Copy path", onClick: () => { void navigator.clipboard?.writeText(node.path); } },
    ...(onDelete ? [{ label: "Delete", onClick: () => onDelete(node.path), danger: true }] : []),
  ];

  const renderMenu = () =>
    menu && (
      <div
        className="fixed z-50 min-w-[160px] rounded-lg border border-white/10 bg-[#1b1b20] py-1 shadow-2xl"
        style={{ top: menu.y, left: menu.x }}
        onClick={(e) => e.stopPropagation()}
      >
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={() => { item.onClick(); setMenu(null); }}
            className={cn(
              "w-full px-3 py-1.5 text-left text-xs transition-colors",
              item.danger ? "text-red-400 hover:bg-red-500/10" : "text-white/75 hover:bg-white/10",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    );

  if (node.type === "dir") {
    return (
      <div>
        <button
          onClick={() => setOpen((prev) => !prev)}
          onContextMenu={openMenu}
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
        {renderMenu()}
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
              onNewFile={onNewFile}
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
          onChange={(e) => { setRenameValue(e.target.value); if (renameError) setRenameError(null); }}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") cancelRename();
          }}
          className={cn(
            "w-full bg-white/10 text-white text-xs px-1.5 py-0.5 rounded border outline-none font-mono",
            renameError ? "border-red-500" : "border-white/20",
          )}
          title={renameError ?? undefined}
        />
        {renameError && <p className="text-[10px] text-red-400 mt-0.5 px-0.5">{renameError}</p>}
      </div>
    );
  }

  return (
    <div
      style={{ paddingLeft: 8 + depth * 14 }}
      onContextMenu={openMenu}
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
      {renderMenu()}
    </div>
  );
}
