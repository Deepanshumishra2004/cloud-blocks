"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { FileNode } from "./_lib/types";
import { flattenFilePaths, fuzzyScore } from "./_lib/fileTree";
import { FileIcon } from "./icons";

const MAX_RESULTS = 50;

// Cmd+P / Ctrl+P quick-open. Fuzzy-matches file paths and opens the chosen one.
export function QuickOpen({
  files,
  onSelect,
  onClose,
}: {
  files: FileNode[];
  onSelect: (path: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const allPaths = useMemo(() => flattenFilePaths(files), [files]);

  const results = useMemo(() => {
    if (!query.trim()) return allPaths.slice(0, MAX_RESULTS);
    return allPaths
      .map((path) => ({ path, score: fuzzyScore(query.trim(), path) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score || a.path.length - b.path.length)
      .slice(0, MAX_RESULTS)
      .map((r) => r.path);
  }, [query, allPaths]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setActive(0); }, [query]);

  // Keep the active row in view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (path: string | undefined) => {
    if (!path) return;
    onSelect(path);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/40"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-white/10 bg-[#16161a] shadow-2xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Go to file…"
          className="w-full bg-transparent text-white text-sm px-4 py-3 outline-none border-b border-white/10 font-mono placeholder:text-white/30"
          onKeyDown={(e) => {
            if (e.key === "Escape") { e.preventDefault(); onClose(); }
            else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); choose(results[active]); }
          }}
        />
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-white/30">No matching files</p>
          ) : (
            results.map((path, idx) => {
              const name = path.split("/").pop() ?? path;
              const dir = path.slice(0, path.length - name.length).replace(/\/$/, "");
              return (
                <button
                  key={path}
                  data-idx={idx}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => choose(path)}
                  className={cn(
                    "w-full flex items-center gap-2 px-4 py-1.5 text-left",
                    idx === active ? "bg-white/10" : "hover:bg-white/5",
                  )}
                >
                  <FileIcon ext={name.split(".").pop() ?? ""} />
                  <span className="text-xs text-white/85 font-mono truncate">{name}</span>
                  {dir && <span className="text-[10px] text-white/30 font-mono truncate">{dir}</span>}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
