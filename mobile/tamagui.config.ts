import { defaultConfig } from '@tamagui/config/v5';
import { createTamagui } from 'tamagui';

import { themes } from './src/theme/themes';

export const config = createTamagui({
  ...defaultConfig,
  themes,
});

export default config;

export type AppConfig = typeof config;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
