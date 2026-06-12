import { useEffect, useState } from 'react';
import { Animated } from 'react-native';

import { AuthLanding } from '@/features/onboarding/components/auth-landing';
import { OnboardingCarousel } from '@/features/onboarding/components/onboarding-carousel';
import { SplashScreen } from '@/features/onboarding/components/splash-screen';
import { useAppTheme } from '@/features/theme/app-theme';

type WelcomeStep = 'splash' | 'onboarding' | 'auth';

export default function WelcomeScreen() {
  const [step, setStep] = useState<WelcomeStep>('splash');
  const [splashOpacity] = useState(() => new Animated.Value(0));
  const { mode, toggleTheme } = useAppTheme();

  useEffect(() => {
    Animated.sequence([
      Animated.timing(splashOpacity, { toValue: 1, duration: 360, useNativeDriver: true }),
      Animated.delay(760),
      Animated.timing(splashOpacity, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start(() => setStep('onboarding'));
  }, [splashOpacity]);

  if (step === 'splash') {
    return <SplashScreen opacity={splashOpacity} mode={mode} />;
  }

  if (step === 'auth') {
    return <AuthLanding mode={mode} onToggleTheme={toggleTheme} />;
  }

  return <OnboardingCarousel mode={mode} onToggleTheme={toggleTheme} onDone={() => setStep('auth')} />;
}
