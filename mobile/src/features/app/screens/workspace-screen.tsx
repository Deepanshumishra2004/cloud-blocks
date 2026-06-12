import type { ReactNode } from 'react';

import type { AppSection } from '../app-types';
import { AppShell } from '../components/app-shell';
import { USER } from '../data/static-data';

const TITLES: Record<AppSection, string> = {
  dashboard: 'Account home',
  repls: 'My Repls',
  explore: 'Explore',
  billing: 'Billing',
  keys: 'AI Keys',
  settings: 'Settings',
};

export function WorkspaceScreen({ section, children }: { section: AppSection; children: ReactNode }) {
  return (
    <AppShell activeSection={section} title={TITLES[section]} user={USER}>
      {children}
    </AppShell>
  );
}
