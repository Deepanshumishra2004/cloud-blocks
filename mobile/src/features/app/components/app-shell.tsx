import { useState, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { ScreenShell } from '@/features/onboarding/components/screen-shell';
import { useAppTheme } from '@/features/theme/app-theme';
import type { AppSection, User } from '../app-types';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { BottomNav } from './bottom-nav';

type AppShellProps = {
  activeSection: AppSection;
  title: string;
  user: User;
  children: ReactNode;
};

export function AppShell({ activeSection, title, user, children }: AppShellProps) {
  const { mode } = useAppTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ScreenShell mode={mode}>
      <AppHeader title={title} user={user} onOpenSidebar={() => setSidebarOpen(true)} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="px-4 pb-7 pt-4">
        {children}
      </ScrollView>

      <BottomNav activeSection={activeSection} />

      {sidebarOpen && (
        <View className="absolute inset-x-0 bottom-0 top-0 z-20">
          <AppSidebar activeSection={activeSection} user={user} onClose={() => setSidebarOpen(false)} />
        </View>
      )}
    </ScreenShell>
  );
}
