import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/features/theme/app-theme';

type CardProps = {
  children: ReactNode;
  className?: string;
  strong?: boolean;
};

export function Card({ children, className = '', strong = false }: CardProps) {
  const { isDark } = useAppTheme();
  const base = strong
    ? isDark
      ? 'rounded-md border border-[#1f2937] bg-[#090b0f] p-4'
      : 'rounded-md border border-[#d5e0ee] bg-white p-4'
    : isDark
      ? 'rounded-md border border-[#1f2937] bg-[#090b0f] p-4'
      : 'rounded-md border border-[#d5e0ee] bg-white p-4';

  return <View className={`${base} ${className}`}>{children}</View>;
}

export function Button({ label, onPress, tone = 'default' }: { label: string; onPress?: () => void; tone?: 'default' | 'danger' }) {
  const danger = tone === 'danger';
  return (
    <Pressable
      onPress={onPress}
      className={danger ? 'h-11 items-center justify-center rounded-md border border-danger/25 bg-danger/10 active:scale-[0.98] active:opacity-90' : 'h-11 items-center justify-center rounded-md border border-[#1f2937] bg-[#0b0d10] active:scale-[0.98] active:opacity-90'}>
      <Text className={danger ? 'text-sm font-black text-danger' : 'text-sm font-black text-cb-primary'}>{label}</Text>
    </Pressable>
  );
}

export function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <View className={active ? 'rounded-md border border-success/25 bg-success/10 px-2.5 py-1' : 'rounded-md border border-[#1f2937] bg-[#0b0d10] px-2.5 py-1'}>
      <Text className={active ? 'text-[10px] font-black text-success' : 'text-[10px] font-black text-cb-muted'}>{label}</Text>
    </View>
  );
}

export function SectionHeader({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-lg font-black text-cb-primary">{title}</Text>
      {action && (
        <Pressable onPress={onPress}>
          <Text className="text-xs font-black text-brand">{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function HeroPanel({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <Card strong>
      <Text className="text-[11px] font-black uppercase tracking-[1.5px] text-accent-orange">{eyebrow}</Text>
      <Text className="mt-2 text-[24px] font-black leading-[29px] text-cb-primary">{title}</Text>
      <Text className="mt-3 text-sm font-semibold leading-5 text-cb-secondary">{description}</Text>
    </Card>
  );
}

export function MetricCard({ label, value, tone = 'brand' }: { label: string; value: string; tone?: 'brand' | 'lime' | 'orange' | 'pink' }) {
  const toneClass = {
    brand: 'text-brand',
    lime: 'text-accent-lime',
    orange: 'text-accent-orange',
    pink: 'text-accent-pink',
  }[tone];

  return (
    <Card className="flex-1">
      <Text className={`text-2xl font-black ${toneClass}`}>{value}</Text>
      <Text className="mt-1 text-xs font-bold text-cb-muted">{label}</Text>
    </Card>
  );
}

export function ListItem({
  title,
  subtitle,
  leading,
  trailing,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Card>
      <View className="flex-row items-center gap-3">
        {leading}
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-sm font-black text-cb-primary">{title}</Text>
          {subtitle && <Text className="mt-1 text-xs font-semibold text-cb-muted">{subtitle}</Text>}
        </View>
        {trailing}
      </View>
    </Card>
  );
}

export function ProgressBar({ value, max, tone = 'brand' }: { value: number; max: number; tone?: 'brand' | 'orange' | 'success' }) {
  const percent = Math.min(100, Math.round((value / max) * 100));
  const toneClass = {
    brand: 'bg-brand',
    orange: 'bg-accent-orange',
    success: 'bg-success',
  }[tone];

  return (
    <View className="h-2 overflow-hidden rounded-full bg-white/10">
      <View className={`h-full rounded-full ${toneClass}`} style={{ width: `${percent}%` }} />
    </View>
  );
}
