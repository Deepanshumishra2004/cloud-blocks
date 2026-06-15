import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { Repl } from '../app-types';
import { Button, Card, StatusBadge } from '../ui/primitives';

export function ReplCard({
  repl,
  detailed = false,
  onToggle,
  busy = false,
}: {
  repl: Repl;
  detailed?: boolean;
  onToggle?: () => void;
  busy?: boolean;
}) {
  const subtitle = repl.lastActive ? `${repl.type} - ${repl.lastActive}` : repl.type;
  return (
    <Pressable onPress={() => router.push(`/repl/${repl.id}`)}>
      <Card>
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-md border border-[#1f2937] bg-black">
            <Text className="font-black text-accent-orange">{repl.type.slice(0, 1)}</Text>
          </View>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-sm font-black text-cb-primary">
              {repl.name}
            </Text>
            <Text className="mt-1 text-[11px] font-bold text-cb-muted">{subtitle}</Text>
          </View>
          <StatusBadge active={repl.status === 'RUNNING'} label={repl.status === 'RUNNING' ? 'Live' : 'Stopped'} />
        </View>
        {detailed && (
          <View className="mt-3 flex-row gap-2">
            <View className="flex-1">
              <Button label={busy ? '…' : repl.status === 'RUNNING' ? 'Stop' : 'Start'} onPress={onToggle} />
            </View>
            <View className="flex-1">
              <Button label="Open" onPress={() => router.push(`/repl/${repl.id}`)} />
            </View>
          </View>
        )}
      </Card>
    </Pressable>
  );
}
