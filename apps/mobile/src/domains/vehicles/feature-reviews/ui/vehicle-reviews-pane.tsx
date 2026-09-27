import { X } from 'lucide-react-native';
import { FlatList, Pressable, View } from 'react-native';

import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Skeleton } from '../../../../design-system/components/ui/skeleton';
import { Text } from '../../../../design-system/components/ui/text';
import type { VehicleReviewsContext } from '../../data/vehicle-interactions';
import type { RelatedReview } from '../../data/vehicle-reviews';
import {
  MAX_SELECTED_REVIEWS,
  type ReviewFilters,
  reviewVehicleName,
} from '../reviews-presentation';
import { VehicleReviewItem } from './vehicle-review-item';
import { VehicleReviewsFilters } from './vehicle-reviews-filters';

export interface VehicleReviewsPaneProps {
  context: VehicleReviewsContext;
  filters: ReviewFilters;
  onFiltersChange: (filters: ReviewFilters) => void;
  loading: boolean;
  failed: boolean;
  limited: boolean;
  failedNames: string;
  items: RelatedReview[];
  visible: RelatedReview[];
  selected: string[];
  selectedReviews: RelatedReview[];
  media: string[];
  onClose: () => void;
  onRetry: () => void;
  onToggle: (id: string) => void;
  onClearFilters: () => void;
  onAsk: () => void;
  onDiscover: () => void;
  onOpenLink: (url: string) => void;
}

/**
 * The reviews sheet of one comparison row (web `VehicleReviewsPane`): the
 * related reports of every compared vehicle, filters, a selection of up to
 * eight reports to take to the chat, and a discovery request when none are
 * indexed yet.
 */
export function VehicleReviewsPane(props: VehicleReviewsPaneProps) {
  const {
    context,
    filters,
    onFiltersChange,
    loading,
    visible,
    selected,
    selectedReviews,
    media,
    onClose,
    onToggle,
    onAsk,
    onOpenLink,
  } = props;
  const selectionFull = selected.length >= MAX_SELECTED_REVIEWS;
  return (
    <View className="bg-background flex-1">
      <View className="border-border flex-row items-start justify-between gap-4 border-b py-2 pr-1 pl-4">
        <View className="min-w-0 flex-1 pt-1">
          <Text className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
            Reviews and context
          </Text>
          <Text role="heading" className="mt-1 text-lg font-semibold">
            {context.row.attribute.label}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close reviews"
          className="size-11 items-center justify-center rounded-full"
          onPress={onClose}
        >
          <Icon as={X} className="text-foreground size-5" />
        </Pressable>
      </View>
      <FlatList
        data={loading ? [] : visible}
        keyExtractor={keyOf}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 p-4"
        ListHeaderComponent={
          <View className="gap-4">
            <VehicleReviewsFilters
              context={context}
              filters={filters}
              media={media}
              onFiltersChange={onFiltersChange}
            />
            <ListStatus {...props} />
          </View>
        }
        renderItem={({ item }) => (
          <VehicleReviewItem
            review={item}
            vehicleName={reviewVehicleName(context, item)}
            selected={selected.includes(item.id)}
            selectionFull={selectionFull}
            onToggle={onToggle}
            onOpenLink={onOpenLink}
          />
        )}
      />
      <View className="border-border bg-background gap-2 border-t px-4 pt-3 pb-8">
        {selectedReviews.length ? (
          <FlatList
            horizontal
            data={selectedReviews}
            keyExtractor={keyOf}
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2"
            accessibilityLabel="Selected reports"
            renderItem={({ item }) => (
              <Button
                variant="secondary"
                size="sm"
                className="min-h-11 max-w-60"
                accessibilityLabel={`Remove selection: ${item.title}`}
                onPress={() => onToggle(item.id)}
              >
                <Text numberOfLines={1} className="shrink">
                  {item.title}
                </Text>
                <Text>×</Text>
              </Button>
            )}
          />
        ) : null}
        <View className="flex-row items-center justify-between gap-3">
          <Text
            className="text-muted-foreground flex-1 text-xs"
            accessibilityLiveRegion="polite"
          >
            {selectedReviews.length} of {MAX_SELECTED_REVIEWS} selected
          </Text>
          <Button
            className="min-h-11"
            disabled={!selectedReviews.length || loading}
            accessibilityLabel="Take to the chat"
            onPress={onAsk}
          >
            <Text>
              Take to the chat
              {selectedReviews.length ? ` (${selectedReviews.length})` : ''} ↗
            </Text>
          </Button>
        </View>
      </View>
    </View>
  );
}

function keyOf(review: RelatedReview): string {
  return review.id;
}

/** Loading, failure, counts and the empty outcomes above the list. */
function ListStatus({
  loading,
  failed,
  failedNames,
  limited,
  items,
  visible,
  selectedReviews,
  onRetry,
  onClearFilters,
  onDiscover,
}: VehicleReviewsPaneProps) {
  if (loading)
    return (
      <View className="gap-4" accessibilityLiveRegion="polite">
        <Text className="text-muted-foreground text-sm">
          Looking up related reviews…
        </Text>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </View>
    );
  return (
    <View className="gap-3">
      {failedNames || failed ? (
        <View
          accessibilityRole="alert"
          className="border-border gap-2 rounded-xl border p-4"
        >
          <Text className="text-sm leading-6">
            The reviews{failedNames ? ` for ${failedNames}` : ''} could not be
            retrieved. That does not mean no reports exist.
          </Text>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 self-start"
            accessibilityLabel="Try again"
            onPress={onRetry}
          >
            <Text>Try again</Text>
          </Button>
        </View>
      ) : null}
      {items.length ? (
        <>
          <Text
            className="text-muted-foreground text-xs"
            accessibilityLiveRegion="polite"
          >
            {visible.length} of {items.length} reports loaded ·{' '}
            {selectedReviews.length} selected
          </Text>
          {limited ? (
            <Text className="text-muted-foreground text-xs">
              Showing up to 30 reports per vehicle. Use the chat for a more
              specific search.
            </Text>
          ) : null}
          {visible.length ? null : (
            <View className="items-center gap-3 py-8">
              <Text className="text-sm">No report matches the filters.</Text>
              <Button
                variant="outline"
                className="min-h-11"
                accessibilityLabel="Clear filters"
                onPress={onClearFilters}
              >
                <Text>Clear filters</Text>
              </Button>
            </View>
          )}
        </>
      ) : failedNames || failed ? null : (
        <View className="items-center gap-2 py-8">
          <Text className="text-center font-medium">
            No reviews are indexed for this item yet
          </Text>
          <Text className="text-muted-foreground text-center text-sm leading-6">
            You can ask the assistant to find articles and videos. The links it
            finds are presented as references that have not been verified yet.
          </Text>
          <Button
            variant="outline"
            className="mt-3 min-h-11"
            accessibilityLabel="Search with the assistant"
            onPress={onDiscover}
          >
            <Text>Search with the assistant ↗</Text>
          </Button>
        </View>
      )}
    </View>
  );
}
