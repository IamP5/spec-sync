import { View } from 'react-native';

import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import type { ChatMessage } from '../../data/chat-message';

/** One transcript line: user text in a capsule, assistant text full width. */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const fromUser = message.role === 'user';
  return (
    <View
      className={cn(
        'max-w-full',
        fromUser && 'bg-muted max-w-[85%] self-end rounded-3xl px-4 py-2.5',
      )}
      accessibilityLabel={fromUser ? 'You' : 'Assistant'}
    >
      <Text selectable className="text-base leading-6">
        {message.text}
      </Text>
    </View>
  );
}
