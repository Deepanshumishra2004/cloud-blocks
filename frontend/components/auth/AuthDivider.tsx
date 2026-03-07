// src/components/auth/AuthDivider.tsx
export function AuthDivider({ text = "or" }: { text?: string }) {
    return (
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-cb-border" />
        <span className="text-2xs font-mono font-semibold text-cb-muted uppercase tracking-widest">
          {text}
        </span>
        <div className="flex-1 h-px bg-cb-border" />
      </div>
    );
  }