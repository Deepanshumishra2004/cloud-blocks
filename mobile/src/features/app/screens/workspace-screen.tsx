import type { ReactNode } from 'react';

import { useAuth } from '@/features/auth/auth-store';
import type { AppSection, User } from '../app-types';
import { AppShell } from '../components/app-shell';

const TITLES: Record<AppSection, string> = {
  dashboard: 'Account home',
  repls: 'My Repls',
  explore: 'Explore',
  billing: 'Billing',
  keys: 'AI Keys',
  settings: 'Settings',
};

const PLACEHOLDER_USER: User = {
  id: '',
  email: '',
  username: 'Account',
  provider: 'EMAIL',
  avatar: null,
  createdAt: '',
  updatedAt: '',
};

export function WorkspaceScreen({ section, children }: { section: AppSection; children: ReactNode }) {
  const { user } = useAuth();
  return (
    <AppShell activeSection={section} title={TITLES[section]} user={user ?? PLACEHOLDER_USER}>
      {children}
    </AppShell>
  );
}
