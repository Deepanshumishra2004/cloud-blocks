import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ThemeToggle } from '@/features/onboarding/components/theme-toggle';
import { useAppTheme } from '@/features/theme/app-theme';
import type { User } from '../app-types';
import { surfaceClass, textClass } from '../ui/surface';
import { ProfilePill } from './profile-pill';

type AppHeaderProps = {
  title: string;
  user: User;
  onOpenSidebar: () => void;
};

export function AppHeader({ title, user, onOpenSidebar }: AppHeaderProps) {
  const { mode, isDark, toggleTheme } = useAppTheme();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <View className={`relative min-h-[60px] flex-row items-center gap-3 border-b px-4 py-2 ${surfaceClass(isDark, 'header')}`}>
      <Pressable accessibilityLabel="Open navigation" onPress={onOpenSidebar} className={`h-10 w-10 items-center justify-center rounded-md border ${surfaceClass(isDark, 'muted')}`}>
        <Text className={`text-lg font-black ${textClass(isDark)}`}>=</Text>
      </Pressable>

      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className={`text-lg font-black ${textClass(isDark)}`}>
          {title}
        </Text>
        <Text numberOfLines={1} className={`text-[11px] font-semibold ${textClass(isDark, 'muted')}`}>
          {user.email}
        </Text>
      </View>

      <ThemeToggle mode={mode} onToggle={toggleTheme} />
      <Pressable
        accessibilityLabel="User menu"
        onPress={() => setProfileOpen((value) => !value)}
        className={`h-10 flex-row items-center gap-2 rounded-md px-1.5 active:opacity-80 ${isDark ? 'active:bg-white/5' : 'active:bg-[#eef4ff]'}`}>
        <ProfilePill user={user} />
        <Text className={`text-xs ${textClass(isDark, 'muted')}`}>v</Text>
      </Pressable>

      {profileOpen && (
        <View className={`absolute right-4 top-[58px] z-30 w-56 rounded-md border p-2 ${surfaceClass(isDark, 'card')}`}>
          <View className="border-b border-[#1f2937] px-2 pb-2">
            <Text numberOfLines={1} className={`text-xs font-black ${textClass(isDark)}`}>{user.username}</Text>
            <Text numberOfLines={1} className={`mt-0.5 text-[11px] ${textClass(isDark, 'muted')}`}>{user.email}</Text>
          </View>
          <MenuItem label="Profile & Settings" onPress={() => router.push('/settings')} isDark={isDark} />
          <MenuItem label="Billing" onPress={() => router.push('/billing')} isDark={isDark} />
          <View className="my-1 h-px bg-[#1f2937]" />
          <MenuItem label="Sign out" isDark={isDark} danger />
        </View>
      )}
    </View>
  );
}

function MenuItem({ label, onPress, isDark, danger = false }: { label: string; onPress?: () => void; isDark: boolean; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} className="mt-1 min-h-9 justify-center rounded-md px-2 active:bg-white/5">
      <Text className={danger ? 'text-xs font-semibold text-danger' : `text-xs font-semibold ${textClass(isDark, 'secondary')}`}>{label}</Text>
    </Pressable>
  );
}
