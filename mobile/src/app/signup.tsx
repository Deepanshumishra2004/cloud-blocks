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
import { PasswordStrengthMeter } from '@/features/auth/components/password-strength-meter';
import { useAuth } from '@/features/auth/auth-store';
import { useAppTheme } from '@/features/theme/app-theme';

type FieldErrors = {
  email?: string;
  username?: string;
  password?: string;
};

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { mode, isDark, toggleTheme } = useAppTheme();
  const { signUp } = useAuth();

  function validate() {
    const errors: FieldErrors = {};
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      errors.email = 'Enter a valid email address';
    }
    if (username.length < 3) {
      errors.username = 'At least 3 characters';
    } else if (!/^[a-z0-9_]+$/.test(username)) {
      errors.username = 'Only lowercase letters, numbers, underscores';
    }
    if (password.length < 8) {
      errors.password = 'At least 8 characters';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit() {
    setError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      await signUp(email.trim().toLowerCase(), username, password);
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthPage mode={mode} onToggleTheme={toggleTheme}>
      <AuthHeader mode={mode} title="Create your account" subtitle="Free forever. No credit card required." />

      <AuthAlert message={error} />
      <OAuthButtons mode={mode} label="Sign up" />
      <AuthDivider mode={mode} />

      <View className="gap-4">
        <FormField mode={mode} label="Email address" error={fieldErrors.email} required>
          <AuthInput
            mode={mode}
            icon="@"
            error={!!fieldErrors.email}
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setFieldErrors((current) => ({ ...current, email: undefined }));
            }}
            placeholder="you@example.com"
            keyboardType="email-address"
            textContentType="emailAddress"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </FormField>

        <FormField
          mode={mode}
          label="Username"
          error={fieldErrors.username}
          hint={!fieldErrors.username ? 'Lowercase letters, numbers and underscores' : undefined}
          required>
          <AuthInput
            mode={mode}
            icon="#"
            error={!!fieldErrors.username}
            value={username}
            onChangeText={(value) => {
              setUsername(value.toLowerCase());
              setFieldErrors((current) => ({ ...current, username: undefined }));
            }}
            placeholder="your_username"
            textContentType="username"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </FormField>

        <FormField mode={mode} label="Password" error={fieldErrors.password} required>
          <AuthInput
            mode={mode}
            icon="*"
            error={!!fieldErrors.password}
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
            }}
            placeholder="Min. 8 characters"
            textContentType="newPassword"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={submit}
            secureToggle={{ visible: showPassword, onToggle: () => setShowPassword((value) => !value) }}
          />
          <PasswordStrengthMeter password={password} />
        </FormField>

        <Pressable
          onPress={submit}
          disabled={submitting}
          className="mt-1 h-11 items-center justify-center rounded-md border border-brand-hover bg-brand active:opacity-80"
          style={submitting ? { opacity: 0.6 } : undefined}
        >
          <Text className="text-sm font-black text-white">{submitting ? 'Creating…' : 'Create account →'}</Text>
        </Pressable>

        <Text className={`text-center text-[11px] leading-[17px] ${isDark ? 'text-cb-muted' : 'text-[#718198]'}`}>
          By creating an account you agree to our{' '}
          <Text className={isDark ? 'text-cb-secondary underline' : 'text-[#46566d] underline'}>Terms of Service</Text>
          {' '}and{' '}
          <Text className={isDark ? 'text-cb-secondary underline' : 'text-[#46566d] underline'}>Privacy Policy</Text>.
        </Text>
      </View>

      <Text className={`mt-5 text-center text-sm ${isDark ? 'text-cb-secondary' : 'text-[#46566d]'}`}>
        Already have an account?{' '}
        <Link href="/signin" className="font-medium text-brand">
          Sign in
        </Link>
      </Text>
    </AuthPage>
  );
}
