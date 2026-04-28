import type { ReplType } from "@/lib/api";

export function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 1v10M1 6h10" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="7" cy="7" r="5" />
      <path d="M12 12l2.5 2.5" />
    </svg>
  );
}

export function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <circle cx="3" cy="7" r="1.3" />
      <circle cx="7" cy="7" r="1.3" />
      <circle cx="11" cy="7" r="1.3" />
    </svg>
  );
}

export function OpenIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9M9 1h6v6M8 8L14 2" />
    </svg>
  );
}

export function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M11 2l3 3-9 9-4 1 1-4 9-9z" />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="3" width="10" height="10" rx="1.5" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 4h10M5 4V2h6v2M6 7v5M10 7v5M4 4l1 10h6l1-10" />
    </svg>
  );
}

export function WarnIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--danger)" strokeWidth="1.7">
      <path d="M8 1l7 13H1L8 1z" />
      <path d="M8 6v4M8 11.5v.5" strokeLinecap="round" />
    </svg>
  );
}

export function RuntimeIcon({ type }: { type: ReplType | string }) {
  if (type === "BUN") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M9 8.5h3.5a2.75 2.75 0 0 1 0 5.5H9z" />
        <path d="M9 14h4a2.25 2.25 0 0 1 0 4.5H9z" />
      </svg>
    );
  }

  if (type === "JAVASCRIPT") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M10 8v7a2 2 0 0 1-2 2" />
        <path d="M14 16c.3 1 1 1.5 2 1.5 1.2 0 2-.6 2-1.5 0-2-4-1.4-4-4 0-1.1 1-2 2.5-2 1.1 0 1.9.4 2.3 1.3" />
      </svg>
    );
  }

  if (type === "REACT") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="1.5" />
        <ellipse cx="12" cy="12" rx="9" ry="3.8" />
        <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(120 12 12)" />
      </svg>
    );
  }

  if (type === "NEXT") {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 15.5V8.5l7 7V8.5" />
      </svg>
    );
  }

  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7.5h16v9H4z" />
      <path d="M9 7.5V6a3 3 0 0 1 6 0v1.5" />
    </svg>
  );
}
