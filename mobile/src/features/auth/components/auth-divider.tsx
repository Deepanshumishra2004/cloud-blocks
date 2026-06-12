import { Text, View } from 'react-native';

import type { ThemeMode } from '@/features/onboarding/types';
import { authColors } from '../auth-theme';

export function AuthDivider({ mode, text = 'or' }: { mode: ThemeMode; text?: string }) {
  const colors = authColors(mode);

  return (
    <View className="my-4 flex-row items-center gap-3">
      <View className={`h-px flex-1 ${colors.divider}`} />
      <Text className={`font-mono text-[10px] font-semibold uppercase tracking-[2px] ${colors.muted}`}>
        {text}
      </Text>
      <View className={`h-px flex-1 ${colors.divider}`} />
    </View>
  );
}
