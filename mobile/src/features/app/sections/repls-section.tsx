import { Text, View } from 'react-native';

import { ReplCard } from '../components/repl-card';
import { REPLS } from '../data/static-data';
import { Card, HeroPanel, SectionHeader } from '../ui/primitives';

export function ReplsSection() {
  return (
    <View className="gap-4">
      <HeroPanel
        eyebrow="Projects"
        title="Create, run, and inspect repls."
        description="Static UI data uses the same shape as backend repl responses."
      />
      <View className="flex-row gap-3">
        <TemplateCard label="NEXT" description="Full stack app" />
        <TemplateCard label="REACT" description="Frontend UI" />
        <TemplateCard label="BUN" description="Fast runtime" />
      </View>
      <SectionHeader title="Projects" action="Create" />
      <View className="gap-3">
        {REPLS.map((repl) => (
          <ReplCard key={repl.id} repl={repl} detailed />
        ))}
      </View>
    </View>
  );
}

function TemplateCard({ label, description }: { label: string; description: string }) {
  return (
    <Card className="flex-1">
      <Text className="text-sm font-black text-accent-pink">{label}</Text>
      <Text className="mt-1 text-[11px] font-semibold leading-4 text-cb-muted">{description}</Text>
    </Card>
  );
}
