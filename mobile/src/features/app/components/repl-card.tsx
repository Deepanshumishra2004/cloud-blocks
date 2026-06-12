import { Text, View } from 'react-native';

import type { Repl } from '../app-types';
import { Button, Card, StatusBadge } from '../ui/primitives';

export function ReplCard({ repl, detailed = false }: { repl: Repl; detailed?: boolean }) {
  return (
    <Card>
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-md border border-[#1f2937] bg-black">
          <Text className="font-black text-accent-orange">{repl.type.slice(0, 1)}</Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-sm font-black text-cb-primary">
            {repl.name}
          </Text>
          <Text className="mt-1 text-[11px] font-bold text-cb-muted">
            {repl.type} - {repl.lastActive}
          </Text>
        </View>
        <StatusBadge active={repl.status === 'RUNNING'} label={repl.status === 'RUNNING' ? 'Live' : 'Stopped'} />
      </View>
      {detailed && (
        <View className="mt-3 flex-row gap-2">
          <View className="flex-1">
            <Button label={repl.status === 'RUNNING' ? 'Stop' : 'Start'} />
          </View>
          <View className="flex-1">
            <Button label="Preview" />
          </View>
          <View className="flex-1">
            <Button label="AI" />
          </View>
        </View>
      )}
    </Card>
  );
}
