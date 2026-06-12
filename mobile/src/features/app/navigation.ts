import type { AppSection } from './app-types';

export type AppHref = '/dashboard' | '/repls' | '/explore' | '/billing' | '/keys' | '/settings';

export type NavItem = {
  key: AppSection;
  label: string;
  helper: string;
  href: AppHref;
};

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Workspace',
    items: [
      { key: 'dashboard', label: 'Overview', helper: 'Home', href: '/dashboard' },
      { key: 'repls', label: 'Repls', helper: 'Projects', href: '/repls' },
      { key: 'explore', label: 'Explore', helper: 'Templates', href: '/explore' },
    ],
  },
  {
    title: 'Manage',
    items: [
      { key: 'billing', label: 'Billing', helper: 'Plans', href: '/billing' },
      { key: 'keys', label: 'AI Keys', helper: 'Providers', href: '/keys' },
      { key: 'settings', label: 'Settings', helper: 'Profile', href: '/settings' },
    ],
  },
];
