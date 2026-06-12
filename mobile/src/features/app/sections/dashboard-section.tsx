import { router } from 'expo-router';
import { View } from 'react-native';

import { ReplCard } from '../components/repl-card';
import { PLAN, REPLS, USAGE } from '../data/static-data';
import { Button, HeroPanel, MetricCard, SectionHeader } from '../ui/primitives';

export function DashboardSection() {
  const running = REPLS.filter((repl) => repl.status === 'RUNNING').length;

  return (
    <View className="gap-5">
      <HeroPanel
        eyebrow="Cloud workspace"
        title="Everything is ready."
        description="Manage repls, track usage, and keep your cloud coding setup organized from mobile."
      />

      <View className="flex-row gap-3">
        <MetricCard label="Total repls" value={String(REPLS.length)} tone="lime" />
        <MetricCard label="Running" value={String(running)} tone="orange" />
      </View>
      <View className="flex-row gap-3">
        <MetricCard label="Storage" value={`${Math.round(USAGE.storage.usedMb / 1024)}GB`} tone="pink" />
        <MetricCard label="Plan" value={PLAN.name} tone="brand" />
      </View>

      <SectionHeader title="Recent repls" action="View all" onPress={() => router.push('/repls')} />
      <View className="gap-3">
        {REPLS.slice(0, 2).map((repl) => (
          <ReplCard key={repl.id} repl={repl} />
        ))}
      </View>

      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button label="New repl" onPress={() => router.push('/repls')} />
        </View>
        <View className="flex-1">
          <Button label="AI keys" onPress={() => router.push('/keys')} />
        </View>
      </View>
    </View>
  );
}
