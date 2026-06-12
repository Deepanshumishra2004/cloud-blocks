import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';

import { BrandMark } from './brand-mark';
import { ScreenShell } from './screen-shell';
import { ThemeToggle } from './theme-toggle';
import type { ThemeMode } from '../types';

type AuthLandingProps = {
  mode: ThemeMode;
  onToggleTheme: () => void;
};

export function AuthLanding({ mode, onToggleTheme }: AuthLandingProps) {
  const isDark = mode === 'dark';

  return (
    <ScreenShell mode={mode}>
      <View className="min-h-[52px] flex-row items-center justify-end px-5 pb-2 pt-1">
        <ThemeToggle mode={mode} onToggle={onToggleTheme} />
      </View>
      <View className="flex-1 items-center justify-center px-[22px] pb-7 pt-4">
        <View className="mb-8">
          <BrandMark size={72} mode={mode} />
        </View>

        <View className="items-center gap-3">
          <View className={isDark ? 'rounded-full border border-white/10 bg-white/5 px-3 py-1' : 'rounded-full border border-[#d5e0ee] bg-white px-3 py-1'}>
            <Text className="text-[10px] font-black uppercase text-accent-orange">Instant cloud IDE</Text>
          </View>
          <Text className={isDark ? 'text-center text-[42px] font-black leading-[46px] text-cb-primary' : 'text-center text-[42px] font-black leading-[46px] text-[#0d1726]'}>
            CloudBlocks
          </Text>
          <Text className={isDark ? 'max-w-[310px] text-center text-[16px] font-semibold leading-6 text-cb-secondary' : 'max-w-[310px] text-center text-[16px] font-semibold leading-6 text-[#46566d]'}>
            Build, run, preview, and manage cloud coding projects from one workspace.
          </Text>
        </View>

        <View className="mt-14 w-full gap-3">
          <Pressable
            onPress={() => router.push('/signin')}
            className="h-[52px] items-center justify-center rounded-lg border border-white/15 bg-white active:opacity-80">
            <Text className="text-base font-black text-black">Sign in</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/signup')}
            className={isDark ? 'h-[52px] items-center justify-center rounded-lg border border-white/10 bg-white/5 active:opacity-80' : 'h-[52px] items-center justify-center rounded-lg border border-[#d5e0ee] bg-white active:opacity-80'}>
            <Text className={isDark ? 'text-base font-black text-cb-primary' : 'text-base font-black text-[#0d1726]'}>Sign up</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/dashboard')}
            className={isDark ? 'h-[52px] items-center justify-center rounded-lg border border-accent-orange/30 bg-accent-orange/10 active:opacity-80' : 'h-[52px] items-center justify-center rounded-lg border border-accent-orange/40 bg-accent-orange/10 active:opacity-80'}>
            <Text className="text-base font-black text-accent-orange">Dashboard</Text>
          </Pressable>
        </View>
      </View>
    </ScreenShell>
  );
}
