import type { ThemeMode } from '@/features/onboarding/types';

export function authColors(mode: ThemeMode) {
  const isDark = mode === 'dark';

  return {
    isDark,
    card: isDark
      ? 'border border-white/10 bg-[#070707]'
      : 'border border-[#d5e0ee] bg-white',
    text: isDark ? 'text-cb-primary' : 'text-[#0d1726]',
    secondary: isDark ? 'text-cb-secondary' : 'text-[#46566d]',
    muted: isDark ? 'text-cb-muted' : 'text-[#718198]',
    field: isDark
      ? 'border border-white/10 bg-black text-cb-primary'
      : 'border border-[#d5e0ee] bg-white text-[#0d1726]',
    oauth: isDark
      ? 'border border-white/10 bg-white/[0.04]'
      : 'border border-[#d5e0ee] bg-[#f7f9fc]',
    divider: isDark ? 'bg-white/10' : 'bg-[#d5e0ee]',
    subtle: isDark ? 'bg-white/[0.04]' : 'bg-[#f7f9fc]',
  };
}
