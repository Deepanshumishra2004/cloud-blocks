export function AtIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="8" cy="8" r="3" />
      <path d="M11 8c0 2.2 1 3 2 3 0-2.5 0-8-5-8a5 5 0 000 10c1.5 0 2.8-.6 3.7-1.5" />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M1.5 3.5l6.5 5.5 6.5-5.5" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5 7V5.5a3 3 0 016 0V7" />
    </svg>
  );
}

export function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

export function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2 2l12 12" />
      <path d="M6.5 6.6A3 3 0 0011 11" />
      <path d="M4.5 4.6C2.9 5.7 1.5 7.8 1.5 8s2.5 5 6.5 5c1.3 0 2.4-.4 3.3-1" />
      <path d="M9.5 3.1C9 3 8.5 3 8 3 4 3 1.5 8 1.5 8s.4.9 1.2 1.9" />
    </svg>
  );
}

export function ProviderIcon({ provider }: { provider: "GOOGLE" | "GITHUB" | "EMAIL" }) {
  if (provider === "GOOGLE") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12h8" />
      </svg>
    );
  }

  if (provider === "GITHUB") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3a9 9 0 00-3 17.5V17.5c-2 .4-2.5-1-2.5-1-.4-1-.9-1.3-.9-1.3-.8-.5.1-.5.1-.5.9.1 1.4.9 1.4.9.8 1.4 2.2 1 2.8.8.1-.6.3-1 .5-1.2-1.8-.2-3.8-.9-3.8-4a3.1 3.1 0 01.8-2.2 2.9 2.9 0 01.1-2.2s.7-.2 2.3.8a8 8 0 014.2 0c1.6-1 2.3-.8 2.3-.8a2.9 2.9 0 01.1 2.2 3.1 3.1 0 01.8 2.2c0 3.1-2 3.8-3.8 4 .3.3.6.8.6 1.7v2.5A9 9 0 0012 3z" />
      </svg>
    );
  }

  return <span className="text-xs">@</span>;
}
