import { Text, View } from 'react-native';

import type { User } from '../app-types';

export function ProfilePill({ user }: { user: User }) {
  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <View className="h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-accent-orange">
      <Text className="text-xs font-black text-black">{initials}</Text>
    </View>
  );
}
