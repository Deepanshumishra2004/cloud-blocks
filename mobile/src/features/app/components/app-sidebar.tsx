import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { BrandMark } from '@/features/onboarding/components/brand-mark';
import { useAppTheme } from '@/features/theme/app-theme';
import type { AppSection, User } from '../app-types';
import { NAV_GROUPS, type AppHref } from '../navigation';
import { surfaceClass, textClass } from '../ui/surface';
import { PLAN, USAGE } from '../data/static-data';

type AppSidebarProps = {
  activeSection: AppSection;
  user: User;
  onClose: () => void;
};

export function AppSidebar({ activeSection, user, onClose }: AppSidebarProps) {
  const { mode, isDark } = useAppTheme();

  function select(href: AppHref) {
    router.push(href);
    onClose();
  }

  return (
    <View className="h-full flex-row bg-black/40">
      <View className={`h-full w-[300px] border-r px-3 py-3 ${surfaceClass(isDark, 'card')}`}>
        <SidebarHeader user={user} mode={mode} isDark={isDark} onClose={onClose} />

        <Pressable
          onPress={() => select('/repls')}
          className="mb-3 h-10 flex-row items-center justify-center gap-2 rounded-md border border-brand-border bg-brand active:scale-[0.98] active:opacity-90">
          <Text className="text-sm font-black text-white">+</Text>
          <Text className="text-sm font-black text-white">New Repl</Text>
        </Pressable>

        <View className={`mb-4 h-10 justify-center rounded-md border px-3 ${surfaceClass(isDark, 'muted')}`}>
          <Text className={`text-xs font-semibold ${textClass(isDark, 'muted')}`}>Search projects...</Text>
        </View>

        {NAV_GROUPS.map((group) => (
          <View key={group.title} className="mb-5">
            <Text className={`mb-2 px-2 text-[11px] font-bold ${textClass(isDark, 'muted')}`}>
              {group.title}
            </Text>
            <View>
              {group.items.map((item) => {
                const active = item.key === activeSection;
                return <SidebarNavItem key={item.key} item={item} active={active} isDark={isDark} onPress={() => select(item.href)} />;
              })}
            </View>
          </View>
        ))}

        <View className="mt-auto gap-3">
          <SidebarUtility label="Learn" isDark={isDark} />
          <SidebarUtility label="Documentation" isDark={isDark} />
          <PlanUsage isDark={isDark} />
          <View className={`rounded-md border p-3 ${surfaceClass(isDark, 'muted')}`}>
            <Text className={`text-xs font-black ${textClass(isDark)}`}>Profile</Text>
            <Text numberOfLines={1} className={`mt-1 text-xs ${textClass(isDark, 'muted')}`}>
              {user.email}
            </Text>
          </View>
        </View>
      </View>
      <Pressable className="flex-1" onPress={onClose} />
    </View>
  );
}

function SidebarHeader({ user, mode, isDark, onClose }: { user: User; mode: 'dark' | 'light'; isDark: boolean; onClose: () => void }) {
  return (
    <View className="mb-4 flex-row items-center gap-3 px-1">
      <BrandMark size={30} mode={mode} />
      <View className="min-w-0 flex-1">
        <Text className={`text-sm font-black ${textClass(isDark)}`}>CloudBlocks</Text>
        <Text numberOfLines={1} className={`text-[11px] font-semibold ${textClass(isDark, 'muted')}`}>
          {user.username}
        </Text>
      </View>
      <Pressable onPress={onClose} className={`h-8 w-8 items-center justify-center rounded-md border ${surfaceClass(isDark, 'muted')}`}>
        <Text className={`text-lg ${textClass(isDark, 'muted')}`}>x</Text>
      </Pressable>
    </View>
  );
}

function SidebarNavItem({ item, active, isDark, onPress }: { item: { label: string; helper: string }; active: boolean; isDark: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={
        active
          ? isDark
            ? 'min-h-[42px] rounded-md border border-brand-border bg-brand-subtle px-3 py-2'
            : 'min-h-[42px] rounded-md border border-[#d5e0ee] bg-[#eef4ff] px-3 py-2'
          : 'min-h-[42px] rounded-md border border-transparent px-3 py-2 active:bg-white/5'
      }>
      <View className="flex-row items-center justify-between">
        <View>
          <Text className={active ? `text-sm font-black ${textClass(isDark)}` : `text-sm font-semibold ${textClass(isDark, 'secondary')}`}>
            {item.label}
          </Text>
          <Text className={`mt-0.5 text-[10px] font-medium ${textClass(isDark, 'muted')}`}>{item.helper}</Text>
        </View>
        <Text className={active ? 'text-brand' : isDark ? 'text-cb-muted' : 'text-[#718198]'}>&gt;</Text>
      </View>
    </Pressable>
  );
}

function SidebarUtility({ label, isDark }: { label: string; isDark: boolean }) {
  return (
    <Pressable className="h-9 justify-center rounded-md px-3 active:bg-white/5">
      <Text className={`text-xs font-semibold ${textClass(isDark, 'secondary')}`}>{label}</Text>
    </Pressable>
  );
}

function PlanUsage({ isDark }: { isDark: boolean }) {
  return (
    <View className={`rounded-md border p-3 ${surfaceClass(isDark, 'muted')}`}>
      <Text className={`text-[10px] font-black uppercase ${textClass(isDark, 'muted')}`}>{PLAN.name.charAt(0) + PLAN.name.slice(1).toLowerCase()} Plan</Text>
      <UsageLine label="Repls" value={USAGE.repls.used} max={USAGE.repls.max} isDark={isDark} />
      <UsageLine label="Storage" value={USAGE.storage.usedMb} max={USAGE.storage.maxMb} isDark={isDark} suffix="MB" />
      <Pressable className="mt-3 h-9 items-center justify-center rounded-md bg-brand">
        <Text className="text-xs font-black text-white">Upgrade to Teams</Text>
      </Pressable>
    </View>
  );
}

function UsageLine({ label, value, max, suffix = '', isDark }: { label: string; value: number; max: number; suffix?: string; isDark: boolean }) {
  const percent = Math.min(100, Math.round((value / max) * 100));
  return (
    <View className="mt-3">
      <View className="flex-row items-center justify-between">
        <Text className={`text-[11px] font-semibold ${textClass(isDark)}`}>{label}</Text>
        <Text className={`text-[10px] font-medium ${textClass(isDark, 'muted')}`}>{value} / {max} {suffix}</Text>
      </View>
      <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
        <View className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
      </View>
    </View>
  );
}
