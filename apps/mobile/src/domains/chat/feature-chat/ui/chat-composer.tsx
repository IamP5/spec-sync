import { ArrowUp, CornerDownLeft, Square } from 'lucide-react-native';
import { type ReactNode, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import { Textarea } from '../../../../design-system/components/ui/textarea';
import { cn } from '../../../../design-system/lib/utils';

/** Longest prompt the chat sends (web composer limit). */
export const MAX_PROMPT_LENGTH = 4000;

/*
 * The web composer's motion (chat-page.css): layout tweens with a short
 * ease-out; on expand the scale springs back with a damping ratio of 0.35,
 * popping to about 102% before it settles.
 */
const EASE = Easing.bezier(0.32, 0.72, 0, 1);
const FOLD = { duration: 240, easing: EASE };
const UNFOLD = { duration: 280, easing: EASE };
const POP = { dampingRatio: 0.35, duration: 560 };
const LAYOUT = LinearTransition.duration(240).easing(EASE);

/**
 * The message field (web composer): one card holding the prompt, the options
 * row (mode and credits) and the send button, which turns into Stop while a
 * reply streams. `compact` folds it into a slim single-line pill while the
 * reader scrolls through earlier messages. Enter adds a new line on touch
 * devices, as on the web app's phones.
 */
export function ChatComposer({
  value,
  onChangeText,
  onSubmit,
  onStop,
  onFocusChange,
  running,
  disabled,
  compact = false,
  controls,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onFocusChange?: (focused: boolean) => void;
  running: boolean;
  disabled: boolean;
  compact?: boolean;
  /** Mode picker and credits pill. */
  controls?: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const length = value.length;
  const tooLong = length > MAX_PROMPT_LENGTH;
  const canSend = !disabled && value.trim().length > 0 && !tooLong;

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  useEffect(() => {
    scale.set(compact ? withTiming(0.96, FOLD) : withSpring(1, POP));
    opacity.set(withTiming(compact ? 0.9 : 1, compact ? FOLD : UNFOLD));
  }, [compact, opacity, scale]);
  const pop = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ scale: scale.get() }],
  }));

  function focus(next: boolean) {
    setFocused(next);
    onFocusChange?.(next);
  }

  return (
    <Animated.View style={[{ transformOrigin: 'bottom' }, pop]}>
      <Animated.View
        layout={LAYOUT}
        className={cn(
          'bg-card border-border rounded-3xl border p-1 shadow-lg shadow-black/20',
          compact && 'rounded-4xl',
          focused && 'border-ring',
        )}
        style={{ borderCurve: 'continuous' }}
      >
        <Textarea
          value={value}
          onChangeText={onChangeText}
          onFocus={() => focus(true)}
          onBlur={() => focus(false)}
          placeholder="Message SpecSync…"
          accessibilityLabel="Message"
          numberOfLines={Platform.OS === 'web' ? 1 : 6}
          editable={!disabled || running}
          className={cn(
            'mx-4 max-h-32 min-h-11 w-auto rounded-none border-0 bg-transparent px-0 py-2.5 text-base leading-6 shadow-none dark:bg-transparent',
            'resize-none focus-visible:border-transparent focus-visible:ring-0',
            compact && 'mr-14',
          )}
        />
        {compact ? null : (
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(160)}
            className="h-11 flex-row items-center gap-1 pl-1 pr-12"
          >
            {controls}
            {length > MAX_PROMPT_LENGTH * 0.9 ? (
              <Text
                className={cn(
                  'ml-auto text-xs tabular-nums',
                  tooLong ? 'text-destructive' : 'text-muted-foreground',
                )}
                accessibilityLiveRegion="polite"
              >
                {`${length.toLocaleString('en-US')} / 4,000`}
              </Text>
            ) : null}
          </Animated.View>
        )}
        <View className="absolute bottom-1 right-1">
          {running ? (
            <Button
              size="icon"
              className="size-11 rounded-full"
              onPress={onStop}
              accessibilityLabel="Stop generating"
            >
              <Icon
                as={Square}
                className="text-primary-foreground fill-primary-foreground size-4"
              />
            </Button>
          ) : (
            <Button
              size="icon"
              className="size-11 rounded-full"
              onPress={onSubmit}
              disabled={!canSend}
              accessibilityLabel="Send message"
            >
              <Icon
                as={compact ? CornerDownLeft : ArrowUp}
                className="text-primary-foreground size-5"
              />
            </Button>
          )}
        </View>
      </Animated.View>
      {tooLong ? (
        <Text
          role="alert"
          className="text-destructive px-3 pt-1 text-xs"
          accessibilityLiveRegion="polite"
        >
          Use 4,000 characters or fewer.
        </Text>
      ) : null}
    </Animated.View>
  );
}
