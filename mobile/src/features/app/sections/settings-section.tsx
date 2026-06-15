import { View } from 'react-native';

import { useAuth } from '@/features/auth/auth-store';
import { Button, HeroPanel, ListItem } from '../ui/primitives';

export function SettingsSection() {
  const { user, signOut } = useAuth();

  return (
    <View className="gap-4">
      <HeroPanel
        eyebrow="Profile"
        title={user?.username ?? 'Account'}
        description="Manage your account and session."
      />
      <SettingsRow label="Email" value={user?.email ?? '—'} />
      <SettingsRow label="Provider" value={user?.provider ?? '—'} />
      <SettingsRow label="Password" value="Change password" />
      <Button label="Sign out" tone="danger" onPress={() => { void signOut(); }} />
    </View>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return <ListItem title={label} subtitle={value} />;
}
