import { Text, View } from 'react-native';

import { Card, HeroPanel } from '../ui/primitives';

const TEMPLATES = [
  { name: 'Next.js', type: 'NEXT', description: 'Full-stack React app with routes and API handlers.' },
  { name: 'React', type: 'REACT', description: 'Frontend project for dashboards, tools, and prototypes.' },
  { name: 'Bun API', type: 'BUN', description: 'Fast backend service, scripts, and workers.' },
  { name: 'Node.js', type: 'NODE', description: 'General JavaScript runtime for APIs and packages.' },
];

export function ExploreSection() {
  return (
    <View className="gap-4">
      <HeroPanel
        eyebrow="Explore"
        title="Start from a template."
        description="Browse the same project types CloudBlocks can create when the backend is connected."
      />
      <View className="gap-3">
        {TEMPLATES.map((template) => (
          <Card key={template.type}>
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 items-center justify-center rounded-md border border-[#1f2937] bg-black">
                <Text className="text-xs font-black text-accent-orange">{template.type.slice(0, 1)}</Text>
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-sm font-black text-cb-primary">{template.name}</Text>
                <Text className="mt-1 text-xs font-semibold leading-4 text-cb-muted">{template.description}</Text>
              </View>
            </View>
          </Card>
        ))}
      </View>
    </View>
  );
}
