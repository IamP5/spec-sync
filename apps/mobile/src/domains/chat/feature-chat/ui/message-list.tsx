import type { ReactElement, Ref } from 'react';
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  View,
} from 'react-native';

import type { TranscriptItem } from '../../data/chat-message';

/**
 * The transcript, virtualized; the newest turn sits at the bottom, clear of
 * the floating composer. The screen decides how each item renders and
 * follows new content while the reader is at the bottom.
 */
export function MessageList({
  items,
  renderItem,
  empty,
  footer,
  listRef,
  onScroll,
  onContentSizeChange,
  bottomInset = 0,
}: {
  items: TranscriptItem[];
  renderItem: (item: TranscriptItem, index: number) => ReactElement | null;
  empty: ReactElement;
  footer?: ReactElement;
  listRef?: Ref<FlatList<TranscriptItem>>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange?: () => void;
  /** Room under the last item for the floating composer. */
  bottomInset?: number;
}) {
  return (
    <FlatList
      ref={listRef}
      data={items}
      keyExtractor={keyOf}
      renderItem={({ item, index }) => renderItem(item, index)}
      ListEmptyComponent={empty}
      // Spacing and the room for the composer live inside cells, not in the
      // container's gap or padding: `scrollToEnd` only measures cells.
      ItemSeparatorComponent={TurnGap}
      ListFooterComponent={
        <View
          className={footer ? 'pt-7' : undefined}
          style={{ paddingBottom: bottomInset }}
        >
          {footer}
        </View>
      }
      contentContainerClassName="grow px-4 pt-4"
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

/** The space between turns (web `gap-7`). */
function TurnGap() {
  return <View className="h-7" />;
}

function keyOf(item: TranscriptItem): string {
  return `${item.kind}:${item.id}`;
}
