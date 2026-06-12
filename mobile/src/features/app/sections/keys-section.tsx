import { View } from 'react-native';

import { AI_CREDENTIALS } from '../data/static-data';
import { Button, HeroPanel, ListItem, StatusBadge } from '../ui/primitives';

export function KeysSection() {
  return (
    <View className="gap-4">
      <HeroPanel
        eyebrow="AI providers"
        title="Manage active coding assistants."
        description="List provider keys, active status, and masked key values with backend-compatible fields."
      />
      {AI_CREDENTIALS.map((credential) => (
        <ListItem
          key={credential.id}
          title={credential.name}
          subtitle={`${credential.provider} - ${credential.maskedKey}`}
          trailing={<StatusBadge active={credential.isActive} label={credential.isActive ? 'Active' : 'Saved'} />}
        />
      ))}
      <Button label="Add AI key" />
    </View>
  );
}
