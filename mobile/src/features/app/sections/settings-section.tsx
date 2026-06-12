import { View } from 'react-native';

import { USER } from '../data/static-data';
import { Button, HeroPanel, ListItem } from '../ui/primitives';

export function SettingsSection() {
  return (
    <View className="gap-4">
      <HeroPanel
        eyebrow="Profile"
        title={USER.username}
        description="Profile and account controls are staged here for the future API connection."
      />
      <SettingsRow label="Email" value={USER.email} />
      <SettingsRow label="Provider" value={USER.provider} />
      <SettingsRow label="Password" value="Change password" />
      <Button label="Sign out" tone="danger" />
    </View>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return <ListItem title={label} subtitle={value} />;
}
