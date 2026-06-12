import { Text, View } from 'react-native';

const FILES = ['app', 'lib', 'api', 'ui'];
const CODE_LINES = [
  'export default function App() {',
  '  return <CloudBlocks />',
  '}',
  '',
  'bun run dev',
];

export function WorkspacePreview() {
  return (
    <View className="flex-1 rounded-[22px] border border-white/10 bg-[#070707] p-3.5">
      <View className="h-[38px] flex-row items-center gap-2.5 rounded-lg border border-white/10 bg-black px-2.5">
        <View className="flex-row gap-[5px]">
          <View className="h-2 w-2 rounded-full bg-danger" />
          <View className="h-2 w-2 rounded-full bg-warning" />
          <View className="h-2 w-2 rounded-full bg-success" />
        </View>
        <Text className="font-mono text-[11px] font-bold text-cb-secondary">src/app.tsx</Text>
      </View>

      <View className="mt-2.5 flex-1 flex-row gap-2.5">
        <View className="w-16 gap-2">
          {FILES.map((item, index) => (
            <View
              key={item}
              className={index === 0 ? 'h-9 items-center justify-center rounded-lg border border-accent-pink/30 bg-accent-pink/10' : 'h-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]'}>
              <Text className={index === 0 ? 'text-[10px] font-extrabold text-accent-pink' : 'text-[10px] font-extrabold text-cb-muted'}>{item}</Text>
            </View>
          ))}
        </View>

        <View className="flex-1 gap-2.5 rounded-lg border border-white/10 bg-black p-2.5">
          {CODE_LINES.map((line, index) => (
            <View key={`${line}-${index}`} className="flex-row items-center gap-2">
              <Text className="w-3.5 font-mono text-[10px] text-cb-disabled">{index + 1}</Text>
              <Text className={index === 4 ? 'flex-1 font-mono text-[10px] font-bold text-accent-lime' : 'flex-1 font-mono text-[10px] font-bold text-cb-secondary'}>
                {line}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View className="mt-2.5 flex-row gap-2.5">
        <View className="min-h-[74px] flex-1 gap-2 rounded-lg border border-white/10 bg-black p-3">
          <TerminalLine text="server ready on :3000" />
          <TerminalLine text="preview url created" />
        </View>
        <View className="min-h-[74px] flex-1 rounded-lg border border-accent-pink/25 bg-accent-pink/10 p-3">
          <Text className="text-[10px] font-black uppercase text-accent-pink">AI edit</Text>
          <Text className="mt-1 text-[11px] font-bold leading-4 text-cb-secondary">
            Generate code from context
          </Text>
        </View>
      </View>
    </View>
  );
}

function TerminalLine({ text }: { text: string }) {
  return (
    <Text className="font-mono text-[11px] font-bold text-cb-secondary">
      <Text className="text-accent-orange">$</Text> {text}
    </Text>
  );
}
