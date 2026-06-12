import { Text, View } from 'react-native';

type DashboardPreviewProps = {
  compact?: boolean;
};

export function DashboardPreview({ compact = false }: DashboardPreviewProps) {
  return (
    <View className={compact ? 'min-h-[240px] flex-1 rounded-[22px] border border-white/10 bg-[#070707] p-3.5' : 'flex-1 rounded-[22px] border border-white/10 bg-[#070707] p-3.5'}>
      <View className="mb-3.5 flex-row items-center justify-between">
        <View>
          <Text className="text-[11px] font-extrabold uppercase text-accent-lime">Dashboard</Text>
          <Text className="text-2xl font-black text-cb-primary">My Repls</Text>
        </View>
        <View className="h-[38px] w-[38px] items-center justify-center rounded-lg bg-accent-orange">
          <Text className="text-2xl font-extrabold leading-7 text-black">+</Text>
        </View>
      </View>

      <View className="flex-row gap-2">
        <Metric label="Repls" value="08" />
        <Metric label="Running" value="03" />
        <Metric label="Plan" value="PRO" />
      </View>

      <View className="mt-3.5 rounded-xl border border-white/10 bg-white/[0.035] p-3">
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-xs font-extrabold text-cb-primary">Workspace health</Text>
          <Text className="text-[10px] font-black text-accent-lime">READY</Text>
        </View>
        <View className="h-2 overflow-hidden rounded-full bg-white/10">
          <View className="h-full w-4/5 rounded-full bg-accent-lime" />
        </View>
      </View>

      <View className="mt-3.5 gap-2.5">
        <ReplRow name="next-dashboard" type="NEXT" status="RUNNING" />
        <ReplRow name="api-worker" type="BUN" status="RUNNING" />
        {!compact && <ReplRow name="react-demo" type="REACT" status="STOPPED" />}
      </View>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
      <Text className="text-[17px] font-black text-cb-primary">{value}</Text>
      <Text className="mt-0.5 text-[10px] font-bold text-cb-muted">{label}</Text>
    </View>
  );
}

function ReplRow({ name, type, status }: { name: string; type: string; status: 'RUNNING' | 'STOPPED' }) {
  const isRunning = status === 'RUNNING';

  return (
    <View className="min-h-[68px] flex-row items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.035] p-2.5">
      <View className="h-[42px] w-[42px] items-center justify-center rounded-lg border border-white/10 bg-black">
        <Text className={type === 'NEXT' ? 'font-black text-accent-pink' : type === 'BUN' ? 'font-black text-accent-orange' : 'font-black text-brand'}>
          {type.slice(0, 1)}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-extrabold text-cb-primary">{name}</Text>
        <Text className="mt-0.5 text-[11px] font-bold text-cb-muted">{type}</Text>
      </View>
      <View className={isRunning ? 'rounded-full border border-success/25 bg-success/10 px-2 py-1' : 'rounded-full border border-cb-muted/25 bg-cb-muted/10 px-2 py-1'}>
        <Text className={isRunning ? 'text-[10px] font-black text-success' : 'text-[10px] font-black text-cb-muted'}>
          {isRunning ? 'Live' : 'Off'}
        </Text>
      </View>
    </View>
  );
}
