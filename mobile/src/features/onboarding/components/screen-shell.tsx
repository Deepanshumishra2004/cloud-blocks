import type { ReactNode } from 'react';
import { StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CLOUD_BLOCKS } from '@/constants/cloudblocks-theme';
import type { ThemeMode } from '../types';

type ScreenShellProps = {
  children: ReactNode;
  mode: ThemeMode;
};

export function ScreenShell({ children, mode }: ScreenShellProps) {
  const isDark = mode === 'dark';
  const insets = useSafeAreaInsets();
  const backgroundColor = isDark ? CLOUD_BLOCKS.page : '#f7f9fc';

  return (
    <View
      className={isDark ? 'flex-1 overflow-hidden bg-cb-page' : 'flex-1 overflow-hidden bg-[#f7f9fc]'}
      style={{ paddingBottom: insets.bottom }}>
      <StatusBar
        translucent={false}
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundColor}
      />
      <View style={{ height: insets.top, backgroundColor }} />
      <View className="flex-1">{children}</View>
    </View>
  );
}
