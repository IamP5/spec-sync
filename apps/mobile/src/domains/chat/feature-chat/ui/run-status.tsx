import { ActivityIndicator, View } from 'react-native';

import { Button } from '../../../../design-system/components/ui/button';
import { Text } from '../../../../design-system/components/ui/text';

/** What the assistant is doing while a reply streams. */
export function RunStatus({ label }: { label: string }) {
  return (
    <View
      role="status"
      accessibilityLiveRegion="polite"
      className="flex-row items-center gap-2 pt-1"
    >
      <ActivityIndicator size="small" />
      <Text className="text-muted-foreground text-sm">{label}</Text>
    </View>
  );
}

/** The marker after a stopped reply, with a retry. */
export function StoppedMarker({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="items-center gap-2 pt-2">
      <View className="w-full flex-row items-center gap-3">
        <View className="bg-border h-px flex-1" />
        <Text role="status" className="text-muted-foreground text-xs">
          Reply stopped
        </Text>
        <View className="bg-border h-px flex-1" />
      </View>
      <Button
        variant="outline"
        size="sm"
        className="min-h-11"
        onPress={onRetry}
        accessibilityLabel="Try again"
      >
        <Text>Try again</Text>
      </Button>
    </View>
  );
}
