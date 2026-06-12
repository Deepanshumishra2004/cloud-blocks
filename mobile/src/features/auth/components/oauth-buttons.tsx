import { Pressable, Text, View } from 'react-native';

import type { ThemeMode } from '@/features/onboarding/types';
import { authColors } from '../auth-theme';

type OAuthButtonsProps = {
  mode: ThemeMode;
  label: string;
};

export function OAuthButtons({ mode, label }: OAuthButtonsProps) {
  return (
    <View className="gap-2.5">
      <OAuthButton mode={mode} icon="G" label={`${label} with Google`} />
      <OAuthButton mode={mode} icon="GH" label={`${label} with GitHub`} />
    </View>
  );
}

function OAuthButton({ mode, icon, label }: { mode: ThemeMode; icon: string; label: string }) {
  const colors = authColors(mode);

  return (
    <Pressable className={`h-10 flex-row items-center justify-center gap-3 rounded-md px-4 active:opacity-80 ${colors.oauth}`}>
      <View className="h-4 w-5 items-center justify-center">
        <Text className={`text-xs font-black ${colors.text}`}>{icon}</Text>
      </View>
      <Text className={`text-sm font-medium ${colors.text}`}>{label}</Text>
    </Pressable>
  );
}
