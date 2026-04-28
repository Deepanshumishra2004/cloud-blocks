export function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 1v10M1 6h10" />
    </svg>
  );
}

export function CodeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M5 4L1 8l4 4M11 4l4 4-4 4" />
    </svg>
  );
}

export function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M5 3l9 5-9 5V3z" />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
    </svg>
  );
}

export function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M8 1l1.9 3.8 4.2.6-3 2.9.7 4.2L8 10.5l-3.8 2 .7-4.2-3-2.9 4.2-.6L8 1z" />
    </svg>
  );
}

export function ReplTypeIcon({ type }: { type: string }) {
  if (type === "BUN") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 8.5h3.5a2.75 2.75 0 0 1 0 5.5H9z" />
        <path d="M9 14h4a2.25 2.25 0 0 1 0 4.5H9z" />
      </svg>
    );
  }

  if (type === "JAVASCRIPT") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M10 8v7a2 2 0 0 1-2 2" />
        <path d="M14 16c.3 1 1 1.5 2 1.5 1.2 0 2-.6 2-1.5 0-2-4-1.4-4-4 0-1.1 1-2 2.5-2 1.1 0 1.9.4 2.3 1.3" />
      </svg>
    );
  }

  if (type === "REACT") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="1.5" />
        <ellipse cx="12" cy="12" rx="9" ry="3.8" />
        <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(120 12 12)" />
      </svg>
    );
  }

  if (type === "NEXT") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 15.5V8.5l7 7V8.5" />
      </svg>
    );
  }

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7.5h16v9H4z" />
      <path d="M9 7.5V6a3 3 0 0 1 6 0v1.5" />
    </svg>
  );
}
