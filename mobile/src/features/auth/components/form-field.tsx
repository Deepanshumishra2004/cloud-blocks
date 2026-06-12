import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { ThemeMode } from '@/features/onboarding/types';
import { authColors } from '../auth-theme';

type FormFieldProps = {
  mode: ThemeMode;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
};

export function FormField({ mode, label, error, hint, required, children }: FormFieldProps) {
  const colors = authColors(mode);

  return (
    <View className="gap-1">
      <Text className={`text-xs font-medium ${colors.secondary}`}>
        {label}
        {required && <Text className="text-danger"> *</Text>}
      </Text>
      {children}
      {error ? (
        <Text className="text-[11px] text-danger">{error}</Text>
      ) : hint ? (
        <Text className={`text-[11px] ${colors.muted}`}>{hint}</Text>
      ) : null}
    </View>
  );
}
