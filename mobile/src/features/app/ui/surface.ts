export function surfaceClass(isDark: boolean, variant: 'card' | 'muted' | 'header' = 'card') {
  if (variant === 'header') {
    return isDark
      ? 'border-[#111827] bg-[#030406]'
      : 'border-[#e5e7eb] bg-[#f7f9fc]';
  }

  if (variant === 'muted') {
    return isDark
      ? 'border-[#1f2937] bg-[#0b0d10]'
      : 'border-[#d9dee7] bg-[#f8fafc]';
  }

  return isDark
    ? 'border-[#1f2937] bg-[#090b0f]'
    : 'border-[#d9dee7] bg-white';
}

export function textClass(isDark: boolean, tone: 'primary' | 'secondary' | 'muted' = 'primary') {
  if (tone === 'muted') return isDark ? 'text-cb-muted' : 'text-[#667085]';
  if (tone === 'secondary') return isDark ? 'text-cb-secondary' : 'text-[#475467]';
  return isDark ? 'text-cb-primary' : 'text-[#101828]';
}
