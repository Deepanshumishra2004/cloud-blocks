export function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor">
      <path d="M3 2l7 4-7 4V2z" />
    </svg>
  );
}

export function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M10 4L6 8l4 4" />
    </svg>
  );
}

export function ExternalLinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9M9 1h6v6M8 8L14 2" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M1 4a1 1 0 011-1h4l2 2h6a1 1 0 011 1v7a1 1 0 01-1 1H2a1 1 0 01-1-1V4z" />
    </svg>
  );
}

export function ChevronRightIcon({ open }: { open: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ transform: open ? "rotate(90deg)" : "none" }}>
      <path d="M4 2l4 4-4 4" />
    </svg>
  );
}

export function FileIcon({ ext }: { ext: string }) {
  const color: Record<string, string> = {
    ts: "#3b82f6",
    tsx: "#22d3ee",
    js: "#facc15",
    jsx: "#f97316",
    json: "#a3e635",
    css: "#e879f9",
    html: "#f87171",
    md: "#94a3b8",
  };

  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke={color[ext] ?? "#6b7280"} strokeWidth="1.6">
      <path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6L9 1z" />
      <path d="M9 1v5h5" />
    </svg>
  );
}
