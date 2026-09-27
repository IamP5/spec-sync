import { Square } from 'lucide-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';

/** What the assistant is doing while a reply streams (web marker + shimmer). */
export function RunStatus({ label }: { label: string }) {
  const reduceMotion = useReducedMotion();
  const glow = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    glow.set(
      withRepeat(
        withTiming(0.45, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, [glow, reduceMotion]);
  const shimmer = useAnimatedStyle(() => ({ opacity: glow.get() }));

  return (
    <View
      role="status"
      accessibilityLiveRegion="polite"
      className="flex-row items-center gap-2 pt-1"
    >
      <ActivityIndicator size="small" />
      <Animated.View style={shimmer}>
        <Text className="text-muted-foreground text-sm">{label}</Text>
      </Animated.View>
    </View>
  );
}

/** The marker after a stopped reply, with a retry (web `z-marker` separator). */
export function StoppedMarker({ onRetry }: { onRetry: () => void }) {
  return (
    <View className="gap-1 pt-2">
      <View className="w-full flex-row items-center gap-3">
        <View className="bg-border h-px flex-1" />
        <View className="flex-row items-center gap-1.5">
          <Icon as={Square} className="text-muted-foreground size-3" />
          <Text role="status" className="text-muted-foreground text-xs">
            Reply stopped
          </Text>
        </View>
        <View className="bg-border h-px flex-1" />
      </View>
      <Button
        variant="ghost"
        size="sm"
        className="min-h-11 self-start"
        onPress={onRetry}
        accessibilityLabel="Try again"
      >
        <Text>Try again</Text>
      </Button>
    </View>
  );
}
