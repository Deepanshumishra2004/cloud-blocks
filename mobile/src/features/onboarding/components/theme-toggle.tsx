import { Pressable, Text, View } from 'react-native';

import type { ThemeMode } from '../types';

type ThemeToggleProps = {
  mode: ThemeMode;
  onToggle: () => void;
};

export function ThemeToggle({ mode, onToggle }: ThemeToggleProps) {
  const isDark = mode === 'dark';

  return (
    <Pressable
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      hitSlop={8}
      onPress={onToggle}
      className={isDark ? 'relative h-8 w-[62px] shrink-0 rounded-full border border-[#1f2937] bg-[#111318]' : 'relative h-8 w-[62px] shrink-0 rounded-full border border-[#d5e0ee] bg-white'}>
      <Text className={isDark ? 'absolute left-2 top-[8px] text-[10px] font-black text-brand' : 'absolute left-2 top-[8px] text-[10px] font-black text-[#8a94a6]'}>
        D
      </Text>
      <Text className={!isDark ? 'absolute right-2 top-[8px] text-[10px] font-black text-brand' : 'absolute right-2 top-[8px] text-[10px] font-black text-cb-muted'}>
        L
      </Text>
      <View
        className={isDark ? 'absolute top-1 h-6 w-6 rounded-full border border-[#1f2937] bg-black' : 'absolute top-1 h-6 w-6 rounded-full border border-[#d5e0ee] bg-[#f7f9fc]'}
        style={{ transform: [{ translateX: isDark ? 4 : 34 }] }}
      />
    </Pressable>
  );
}
