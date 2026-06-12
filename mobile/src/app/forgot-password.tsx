import { Link } from 'expo-router';
import { Text, View } from 'react-native';

export default function ForgotPasswordPlaceholder() {
  return (
    <View className="flex-1 items-center justify-center bg-cb-page px-6">
      <Text className="text-center text-xl font-black text-cb-primary">Password recovery coming soon</Text>
      <Link href="/signin" className="mt-4 text-brand">
        Back to sign in
      </Link>
    </View>
  );
}
