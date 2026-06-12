import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { ScreenShell } from '@/features/onboarding/components/screen-shell';
import { ThemeToggle } from '@/features/onboarding/components/theme-toggle';
import type { ThemeMode } from '@/features/onboarding/types';
import { authColors } from '../auth-theme';

type AuthPageProps = {
  mode: ThemeMode;
  onToggleTheme: () => void;
  children: ReactNode;
};

export function AuthPage({ mode, onToggleTheme, children }: AuthPageProps) {
  const colors = authColors(mode);

  return (
    <ScreenShell mode={mode}>
      <View className="min-h-[52px] flex-row items-center justify-end px-5 pb-2 pt-1">
        <ThemeToggle mode={mode} onToggle={onToggleTheme} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="min-h-full justify-center px-5 pb-12 pt-4">
          <View className={`w-full rounded-2xl p-6 shadow-2xl shadow-black/30 ${colors.card}`}>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}
