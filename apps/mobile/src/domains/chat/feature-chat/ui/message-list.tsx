import type { ReactElement } from 'react';
import { FlatList } from 'react-native';

import type { ChatMessage } from '../../data/chat-message';
import { MessageBubble } from './message-bubble';

/** The transcript, virtualized; the newest message sits at the bottom. */
export function MessageList({
  messages,
  empty,
  footer,
}: {
  messages: ChatMessage[];
  empty: ReactElement;
  footer?: ReactElement;
}) {
  return (
    <FlatList
      data={messages}
      keyExtractor={keyOf}
      renderItem={renderMessage}
      ListEmptyComponent={empty}
      ListFooterComponent={footer}
      contentContainerClassName="grow gap-4 px-4 py-4"
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    />
  );
}

function keyOf(message: ChatMessage): string {
  return message.id;
}

function renderMessage({ item }: { item: ChatMessage }) {
  return <MessageBubble message={item} />;
}
