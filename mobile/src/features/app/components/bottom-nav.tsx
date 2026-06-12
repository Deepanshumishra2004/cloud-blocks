import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme } from '@/features/theme/app-theme';
import type { AppSection } from '../app-types';
import type { AppHref } from '../navigation';
import { surfaceClass, textClass } from '../ui/surface';

const ITEMS: { key: AppSection; label: string; href: AppHref }[] = [
  { key: 'dashboard', label: 'Home', href: '/dashboard' },
  { key: 'repls', label: 'Repls', href: '/repls' },
  { key: 'billing', label: 'Billing', href: '/billing' },
  { key: 'settings', label: 'Settings', href: '/settings' },
];

export function BottomNav({ activeSection }: { activeSection: AppSection }) {
  const { isDark } = useAppTheme();

  return (
    <View className={`flex-row border-t px-2 py-2 ${surfaceClass(isDark, 'header')}`}>
      {ITEMS.map((item) => {
        const active = item.key === activeSection;
        return (
          <Pressable
            key={item.key}
            onPress={() => router.push(item.href)}
            className={active ? 'h-10 flex-1 items-center justify-center rounded-md bg-brand-subtle' : 'h-10 flex-1 items-center justify-center rounded-md active:bg-white/5'}>
            <Text className={active ? 'text-xs font-black text-brand' : `text-xs font-bold ${textClass(isDark, 'muted')}`}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
