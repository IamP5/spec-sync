import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

import { Text } from '../design-system/components/ui/text';

export default function NotFoundRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="bg-background flex-1 items-center justify-center gap-4 p-6">
        <Text variant="h3">This screen does not exist.</Text>
        <Link href="/" className="text-primary text-base">
          Go to the chat
        </Link>
      </View>
    </>
  );
}
