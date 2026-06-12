import { View } from 'react-native';

import type { ThemeMode } from '../types';

type BrandMarkProps = {
  size?: number;
  mode?: ThemeMode;
};

export function BrandMark({ size = 32, mode = 'dark' }: BrandMarkProps) {
  const color = mode === 'dark' ? '#f8fbff' : '#0d1726';
  const innerColor = mode === 'dark' ? '#030406' : '#f7f9fc';
  const triangleWidth = size * 0.68;
  const triangleHeight = size * 0.62;

  return (
    <View className="relative" style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: (size - triangleWidth) / 2,
          top: size * 0.12,
          width: 0,
          height: 0,
          borderLeftWidth: triangleWidth / 2,
          borderRightWidth: triangleWidth / 2,
          borderBottomWidth: triangleHeight,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.39,
          top: size * 0.42,
          width: 0,
          height: 0,
          borderLeftWidth: size * 0.11,
          borderRightWidth: size * 0.11,
          borderBottomWidth: size * 0.28,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: innerColor,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.12,
          right: size * 0.12,
          bottom: size * 0.07,
          height: Math.max(2, size * 0.08),
          borderRadius: 99,
          backgroundColor: color,
        }}
      />
    </View>
  );
}
