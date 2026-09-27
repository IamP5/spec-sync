import { ArrowUp } from 'lucide-react-native';
import { View } from 'react-native';

import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Textarea } from '../../../../design-system/components/ui/textarea';

/** The message field and its send button; the screen owns the draft. */
export function ChatComposer({
  value,
  onChangeText,
  onSubmit,
  disabled,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const canSend = !disabled && value.trim().length > 0;
  return (
    <View className="border-border bg-background flex-row items-end gap-2 border-t px-4 py-3">
      <Textarea
        value={value}
        onChangeText={onChangeText}
        placeholder="Ask about any vehicle spec"
        accessibilityLabel="Message"
        numberOfLines={5}
        className="min-h-11 flex-1 rounded-3xl px-4"
      />
      <Button
        size="icon"
        className="rounded-full"
        onPress={onSubmit}
        disabled={!canSend}
        accessibilityLabel="Send message"
      >
        <Icon as={ArrowUp} className="text-primary-foreground size-5" />
      </Button>
    </View>
  );
}
