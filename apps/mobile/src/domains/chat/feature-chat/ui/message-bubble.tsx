import { View } from 'react-native';

import { Text } from '../../../../design-system/components/ui/text';

/** The user's turn: plain text in a capsule on the trailing side. */
export function MessageBubble({ text }: { text: string }) {
  return (
    <View
      className="bg-muted max-w-[85%] self-end rounded-3xl px-4 py-2.5"
      accessibilityLabel={`You: ${text}`}
    >
      <Text selectable className="text-base leading-6">
        {text}
      </Text>
    </View>
  );
}
