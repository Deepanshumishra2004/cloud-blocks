import { Text, View } from 'react-native';

export function AuthAlert({ message }: { message: string }) {
  if (!message) return null;

  return (
    <View className="mb-5 flex-row gap-3 rounded-lg border border-danger/25 bg-danger/10 px-4 py-3">
      <Text className="font-mono text-base text-danger">x</Text>
      <Text className="min-w-0 flex-1 text-sm font-semibold leading-5 text-danger">{message}</Text>
    </View>
  );
}
