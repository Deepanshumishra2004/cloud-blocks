import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import type { ThemeMode } from '@/features/onboarding/types';
import { authColors } from '../auth-theme';

type AuthInputProps = TextInputProps & {
  mode: ThemeMode;
  icon: string;
  error?: boolean;
  secureToggle?: {
    visible: boolean;
    onToggle: () => void;
  };
};

export function AuthInput({ mode, icon, error, secureToggle, style, ...props }: AuthInputProps) {
  const colors = authColors(mode);

  return (
    <View className={`h-10 flex-row items-center rounded-md px-3 ${colors.field} ${error ? 'border-danger' : ''}`}>
      <Text className={`mr-3 text-sm ${colors.muted}`}>{icon}</Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.isDark ? '#7f90a8' : '#718198'}
        className={`min-w-0 flex-1 p-0 text-sm font-medium ${colors.text}`}
        style={[{ lineHeight: 20 }, style]}
      />
      {secureToggle && (
        <Pressable hitSlop={10} onPress={secureToggle.onToggle} className="ml-3 h-7 min-w-8 items-center justify-center">
          <Text className={`text-xs font-bold ${colors.muted}`}>{secureToggle.visible ? 'Hide' : 'Show'}</Text>
        </Pressable>
      )}
    </View>
  );
}
