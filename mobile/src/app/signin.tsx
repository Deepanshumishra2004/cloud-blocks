import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { AuthAlert } from '@/features/auth/components/auth-alert';
import { AuthDivider } from '@/features/auth/components/auth-divider';
import { AuthHeader } from '@/features/auth/components/auth-header';
import { AuthInput } from '@/features/auth/components/auth-input';
import { AuthPage } from '@/features/auth/components/auth-page';
import { FormField } from '@/features/auth/components/form-field';
import { OAuthButtons } from '@/features/auth/components/oauth-buttons';
import { useAppTheme } from '@/features/theme/app-theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { mode, isDark, toggleTheme } = useAppTheme();

  function submit() {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    router.replace('/dashboard');
  }

  return (
    <AuthPage mode={mode} onToggleTheme={toggleTheme}>
      <AuthHeader mode={mode} title="Welcome back" subtitle="Sign in to continue building." />

      <AuthAlert message={error} />
      <OAuthButtons mode={mode} label="Sign in" />
      <AuthDivider mode={mode} />

      <View className="gap-4">
        <FormField mode={mode} label="Email address" required>
          <AuthInput
            mode={mode}
            icon="@"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </FormField>

        <FormField mode={mode} label="Password" required>
          <AuthInput
            mode={mode}
            icon="*"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            textContentType="password"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={submit}
            secureToggle={{ visible: showPassword, onToggle: () => setShowPassword((value) => !value) }}
          />
        </FormField>

        <Pressable onPress={submit} className="mt-1 h-11 items-center justify-center rounded-md border border-brand-hover bg-brand active:opacity-80">
          <Text className="text-sm font-black text-white">Sign in →</Text>
        </Pressable>
      </View>

      <Text className={`mt-4 text-center text-sm ${isDark ? 'text-cb-secondary' : 'text-[#46566d]'}`}>
        <Link href="/forgot-password" className="font-medium text-brand">
          Forgot password?
        </Link>
      </Text>

      <Text className={`mt-2 text-center text-sm ${isDark ? 'text-cb-secondary' : 'text-[#46566d]'}`}>
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="font-medium text-brand">
          Sign up free
        </Link>
      </Text>
    </AuthPage>
  );
}
