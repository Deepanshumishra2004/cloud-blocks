import { Text, View } from 'react-native';

import { BrandMark } from './brand-mark';
import type { ThemeMode } from '../types';

export function BrandLockup({ mode }: { mode: ThemeMode }) {
  return (
    <View className="min-w-0 flex-1 flex-row items-center gap-2">
      <View className="shrink-0">
        <BrandMark size={28} mode={mode} />
      </View>
      <Text
        numberOfLines={1}
        ellipsizeMode="tail"
        className={mode === 'dark' ? 'min-w-0 flex-1 text-[16px] font-extrabold text-cb-primary' : 'min-w-0 flex-1 text-[16px] font-extrabold text-[#0d1726]'}>
        CloudBlocks
      </Text>
    </View>
  );
}
