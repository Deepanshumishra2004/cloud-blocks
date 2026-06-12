import { Text, View } from 'react-native';

import { BrandMark } from '@/features/onboarding/components/brand-mark';
import type { ThemeMode } from '@/features/onboarding/types';
import { authColors } from '../auth-theme';

type AuthHeaderProps = {
  mode: ThemeMode;
  title: string;
  subtitle: string;
};

export function AuthHeader({ mode, title, subtitle }: AuthHeaderProps) {
  const colors = authColors(mode);

  return (
    <View className="mb-7">
      <View className="mb-6 flex-row items-center gap-2.5">
        <BrandMark size={28} mode={mode} />
        <Text className={`font-mono text-sm font-bold ${colors.text}`}>cloudblocks</Text>
      </View>
      <Text className={`text-2xl font-bold tracking-tight ${colors.text}`}>{title}</Text>
      <Text className={`mt-1.5 text-sm ${colors.secondary}`}>{subtitle}</Text>
    </View>
  );
}
