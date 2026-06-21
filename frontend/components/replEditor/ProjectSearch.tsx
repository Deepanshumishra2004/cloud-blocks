"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { SearchMatch } from "./_lib/types";

// Cmd+Shift+F project-wide content search. Debounces input, then asks the
// ws-server to grep the workspace; results are streamed back via props.
export function ProjectSearch({
  results,
  truncated,
  loading,
  onSearch,
  onSelect,
  onClose,
}: {
  results: SearchMatch[];
  truncated: boolean;
  loading: boolean;
  onSearch: (query: string) => void;
  onSelect: (path: string, line: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    return () => { if (debounceRef.current !== null) window.clearTimeout(debounceRef.current); };
  }, []);

  const onChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current !== null) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => onSearch(value), 300);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/40"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-white/10 bg-[#16161a] shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-white/10">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); onClose(); } }}
            placeholder="Search in files…"
            className="flex-1 bg-transparent text-white text-sm px-4 py-3 outline-none font-mono placeholder:text-white/30"
          />
          {loading && <span className="text-[10px] text-white/30 pr-4">searching…</span>}
        </div>

        <div className="overflow-y-auto py-1">
          {!query.trim() ? (
            <p className="px-4 py-6 text-center text-xs text-white/30">Type to search file contents</p>
          ) : results.length === 0 && !loading ? (
            <p className="px-4 py-6 text-center text-xs text-white/30">No matches</p>
          ) : (
            <>
              {results.map((m, idx) => (
                <button
                  key={`${m.path}:${m.line}:${idx}`}
                  onClick={() => { onSelect(m.path, m.line); onClose(); }}
                  className={cn("w-full flex items-baseline gap-2 px-4 py-1.5 text-left hover:bg-white/8")}
                >
                  <span className="text-[10px] text-white/35 font-mono shrink-0 w-40 truncate">
                    {m.path}:{m.line}
                  </span>
                  <span className="text-xs text-white/75 font-mono truncate">{m.preview.trim()}</span>
                </button>
              ))}
              {truncated && (
                <p className="px-4 py-2 text-[10px] text-white/30 italic">Results truncated — refine your query.</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
