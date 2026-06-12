import { Text, View } from 'react-native';

import { passwordStrength } from '../password-strength';

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const strength = passwordStrength(password);

  return (
    <View className="mt-1.5 flex-row items-center gap-1">
      {[0, 1, 2, 3].map((index) => (
        <View
          key={index}
          className={`h-1 flex-1 rounded-full ${index < strength.score ? strength.colorClass : 'bg-cb-border-strong'}`}
        />
      ))}
      <Text className={`ml-1 font-mono text-[10px] ${strength.textClass}`}>{strength.label}</Text>
    </View>
  );
}
