import { Stack, DarkTheme, ThemeProvider } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TamaguiProvider } from 'tamagui';

import '@/global.css';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppThemeProvider } from '@/features/theme/app-theme';
import { AuthProvider } from '@/features/auth/auth-store';
import { config } from '../../tamagui.config';

export default function TabLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <TamaguiProvider config={config} defaultTheme="dark">
            <AuthProvider>
              <AnimatedSplashOverlay />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#030406' } }} />
            </AuthProvider>
          </TamaguiProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
