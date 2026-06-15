import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { api } from '@/lib/api';
import type { Usage } from '../app-types';
import { ReplCard } from '../components/repl-card';
import { useRepls } from '../hooks/use-repls';
import { Button, HeroPanel, MetricCard, SectionHeader } from '../ui/primitives';

export function DashboardSection() {
  const { repls } = useRepls();
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getUsage().then((u) => { if (!cancelled) setUsage(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const running = repls.filter((repl) => repl.status === 'RUNNING').length;
  const storageGb = usage ? `${Math.round(usage.storage.usedMb / 1024)}GB` : '—';

  return (
    <View className="gap-5">
      <HeroPanel
        eyebrow="Cloud workspace"
        title="Everything is ready."
        description="Manage repls, track usage, and keep your cloud coding setup organized from mobile."
      />

      <View className="flex-row gap-3">
        <MetricCard label="Total repls" value={String(repls.length)} tone="lime" />
        <MetricCard label="Running" value={String(running)} tone="orange" />
      </View>
      <View className="flex-row gap-3">
        <MetricCard label="Storage" value={storageGb} tone="pink" />
        <MetricCard label="Repls used" value={usage ? `${usage.repls.used}/${usage.repls.max}` : '—'} tone="brand" />
      </View>

      <SectionHeader title="Recent repls" action="View all" onPress={() => router.push('/repls')} />
      <View className="gap-3">
        {repls.slice(0, 2).map((repl) => (
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
