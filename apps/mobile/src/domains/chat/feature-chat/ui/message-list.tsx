import type { ReactElement, Ref } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import type { TranscriptItem } from '../../data/chat-message';

/**
 * The transcript, virtualized; the newest turn sits at the bottom. The screen
 * decides how each item renders and follows new content while the reader is
 * at the bottom.
 */
export function MessageList({
  items,
  renderItem,
  empty,
  footer,
  listRef,
  onScroll,
  onContentSizeChange,
}: {
  items: TranscriptItem[];
  renderItem: (item: TranscriptItem, index: number) => ReactElement | null;
  empty: ReactElement;
  footer?: ReactElement;
  listRef?: Ref<FlatList<TranscriptItem>>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange?: () => void;
}) {
  return (
    <FlatList
      ref={listRef}
      data={items}
      keyExtractor={keyOf}
      renderItem={({ item, index }) => renderItem(item, index)}
      ListEmptyComponent={empty}
      ListFooterComponent={footer}
      contentContainerClassName="grow gap-5 px-4 py-4"
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      onScroll={onScroll}
      scrollEventThrottle={100}
      onContentSizeChange={onContentSizeChange}
      onScrollToIndexFailed={() => undefined}
    />
  );
}

function keyOf(item: TranscriptItem): string {
  return `${item.kind}:${item.id}`;
}
