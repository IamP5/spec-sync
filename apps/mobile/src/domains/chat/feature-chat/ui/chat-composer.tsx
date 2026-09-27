import { ArrowUp, Square } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import { Textarea } from '../../../../design-system/components/ui/textarea';

/** Longest prompt the chat sends (web composer limit). */
export const MAX_PROMPT_LENGTH = 4000;

/**
 * The message field with its controls (web composer): the send button turns
 * into Stop while a reply streams; a counter appears near the limit. Enter
 * adds a new line on touch devices, as on the web app's phones.
 */
export function ChatComposer({
  value,
  onChangeText,
  onSubmit,
  onStop,
  running,
  disabled,
  controls,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  running: boolean;
  disabled: boolean;
  /** Mode picker and credits pill. */
  controls?: ReactNode;
}) {
  const length = value.length;
  const tooLong = length > MAX_PROMPT_LENGTH;
  const canSend = !disabled && value.trim().length > 0 && !tooLong;
  return (
    <View className="border-border bg-background gap-2 border-t px-4 pb-3 pt-2">
      <Textarea
        value={value}
        onChangeText={onChangeText}
        placeholder="Message SpecSync…"
        accessibilityLabel="Message"
        numberOfLines={6}
        editable={!disabled || running}
        className="max-h-40 min-h-11 rounded-2xl px-4"
      />
      <View className="flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center gap-2">{controls}</View>
        {length > MAX_PROMPT_LENGTH * 0.9 ? (
          <Text
            className={
              tooLong
                ? 'text-destructive text-xs'
                : 'text-muted-foreground text-xs'
            }
            accessibilityLiveRegion="polite"
          >
            {tooLong
              ? 'Use 4,000 characters or fewer.'
              : `${length.toLocaleString('en-US')} / 4,000`}
          </Text>
        ) : null}
        {running ? (
          <Button
            size="icon"
            variant="secondary"
            className="size-11 rounded-full"
            onPress={onStop}
            accessibilityLabel="Stop generating"
          >
            <Icon as={Square} className="text-foreground size-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="size-11 rounded-full"
            onPress={onSubmit}
            disabled={!canSend}
            accessibilityLabel="Send message"
          >
            <Icon as={ArrowUp} className="text-primary-foreground size-5" />
          </Button>
        )}
      </View>
      <Text className="text-muted-foreground text-center text-xs">
        Check sources and vehicle details.
      </Text>
    </View>
  );
}
