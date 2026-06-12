import { Animated, Text } from 'react-native';

import { BrandMark } from './brand-mark';
import { ScreenShell } from './screen-shell';
import type { ThemeMode } from '../types';

type SplashScreenProps = {
  opacity: Animated.Value;
  mode: ThemeMode;
};

export function SplashScreen({ opacity, mode }: SplashScreenProps) {
  return (
    <ScreenShell mode={mode}>
      <Animated.View className="flex-1 items-center justify-center gap-[18px]" style={{ opacity }}>
        <BrandMark size={72} mode={mode} />
        <Text className={mode === 'dark' ? 'text-3xl font-extrabold text-cb-primary' : 'text-3xl font-extrabold text-[#0d1726]'}>
          CloudBlocks
        </Text>
      </Animated.View>
    </ScreenShell>
  );
}
