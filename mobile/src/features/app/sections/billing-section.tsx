import { Text, View } from 'react-native';

import { PLAN, SUBSCRIPTION, USAGE } from '../data/static-data';
import { Card, HeroPanel, ProgressBar } from '../ui/primitives';

export function BillingSection() {
  return (
    <View className="gap-4">
      <HeroPanel
        eyebrow="Subscription"
        title={`${SUBSCRIPTION.plan.name} plan is active.`}
        description="Preview pricing, limits, and usage exactly like the web dashboard billing page."
      />
      <PlanCard />
      <UsageMeter label="Repls" used={USAGE.repls.used} max={USAGE.repls.max} />
      <UsageMeter label="Storage" used={USAGE.storage.usedMb} max={USAGE.storage.maxMb} suffix="MB" />
      <UsageMeter label="Compute" used={USAGE.compute.usedHrs} max={USAGE.compute.maxHrs} suffix="hrs" />
    </View>
  );
}

function PlanCard() {
  return (
    <Card>
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="text-xl font-black text-cb-primary">{PLAN.name}</Text>
          <Text className="mt-1 text-xs font-semibold text-cb-muted">{PLAN.billingCycle}</Text>
        </View>
        <Text className="text-xl font-black text-accent-lime">${PLAN.price / 100}</Text>
      </View>
      <Text className="mt-3 text-sm font-semibold text-cb-secondary">
        {PLAN.maxRepls} repls and {Math.round(PLAN.maxStorageMB / 1024)}GB storage included.
      </Text>
    </Card>
  );
}

function UsageMeter({ label, used, max, suffix = '' }: { label: string; used: number; max: number; suffix?: string }) {
  const percent = Math.min(100, Math.round((used / max) * 100));

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-black text-cb-primary">{label}</Text>
        <Text className="text-xs font-bold text-cb-muted">
          {used}{suffix ? ` ${suffix}` : ''} / {max}{suffix ? ` ${suffix}` : ''}
        </Text>
      </View>
      <View className="mt-3">
        <ProgressBar value={used} max={max} tone={percent > 80 ? 'orange' : 'brand'} />
      </View>
    </Card>
  );
}
