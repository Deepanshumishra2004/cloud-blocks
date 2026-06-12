import { Text, View } from 'react-native';

export function PreviewRuntimePreview() {
  return (
    <View className="flex-1 rounded-[22px] border border-white/10 bg-[#070707] p-3.5">
      <View className="h-[46px] justify-center rounded-lg border border-white/10 bg-black px-2.5">
        <View className="h-7 flex-row items-center gap-2 rounded-md bg-white/[0.05] px-2.5">
          <View className="h-[7px] w-[7px] rounded-full bg-success" />
          <Text className="text-[11px] font-extrabold text-cb-secondary">app.cloudblocks.dev</Text>
        </View>
      </View>

      <View className="mt-3 h-[146px] justify-center gap-4 rounded-[10px] border border-accent-violet/30 bg-accent-violet/10 p-5">
        <View>
          <Text className="text-[10px] font-black uppercase text-accent-violet">Preview</Text>
          <Text className="mt-1 text-2xl font-black text-cb-primary">Launch UI</Text>
        </View>
        <View className="h-8 w-32 rounded-md bg-accent-orange" />
      </View>

      <View className="mt-3 flex-1 flex-row gap-2.5">
        <View className="flex-[1.2] justify-end gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] p-3.5">
          <View className="h-[9px] w-4/5 rounded bg-cb-primary/20" />
          <View className="h-[9px] w-3/5 rounded bg-cb-primary/20" />
        </View>
        <View className="flex-[0.8] gap-2.5">
          <View className="flex-1 rounded-[10px] border border-accent-pink/25 bg-accent-pink/10" />
          <View className="flex-1 rounded-[10px] border border-brand/25 bg-brand/10" />
        </View>
      </View>

      <View className="mt-3 h-[52px] justify-center gap-[7px] rounded-lg border border-success/25 bg-success/10 px-3">
        <View className="flex-row items-center justify-between">
          <Text className="text-[10px] font-black text-success">RUNNING</Text>
          <Text className="text-[10px] font-black text-cb-secondary">74%</Text>
        </View>
        <View className="h-[5px] overflow-hidden rounded-full bg-success/15">
          <View className="h-full w-3/4 rounded-full bg-success" />
        </View>
      </View>
    </View>
  );
}
