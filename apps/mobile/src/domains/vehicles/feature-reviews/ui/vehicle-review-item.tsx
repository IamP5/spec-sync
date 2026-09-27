import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Badge } from '../../../../design-system/components/ui/badge';
import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import {
  type RelatedReview,
  reviewMedia,
  reviewUrl,
} from '../../data/vehicle-reviews';
import { displayValue } from '../../util/vehicle-display';
import { reviewKind } from '../reviews-presentation';

/** One related report with its selection toggle and its origin. */
export function VehicleReviewItem({
  review,
  vehicleName,
  selected,
  selectionFull,
  onToggle,
  onOpenLink,
}: {
  review: RelatedReview;
  vehicleName: string;
  selected: boolean;
  /** Eight reports are selected: only a selected one can change. */
  selectionFull: boolean;
  onToggle: (id: string) => void;
  onOpenLink: (url: string) => void;
}) {
  const [originOpen, setOriginOpen] = useState(false);
  const href = reviewUrl(review);
  return (
    <View
      className={cn(
        'rounded-xl border p-4',
        selected
          ? 'border-foreground bg-muted/30'
          : 'border-border bg-background',
      )}
    >
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Badge variant="secondary">
          <Text>{reviewMedia(review.mediaType)}</Text>
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11"
          disabled={!selected && selectionFull}
          accessibilityLabel={
            selected
              ? `Remove selection: ${review.title}`
              : `Select report: ${review.title}`
          }
          accessibilityState={{
            selected,
            disabled: !selected && selectionFull,
          }}
          onPress={() => onToggle(review.id)}
        >
          <Text>{selected ? 'Selected ✓' : 'Select +'}</Text>
        </Button>
      </View>
      <Text className="text-base leading-6 font-semibold">{review.title}</Text>
      <Text className="text-muted-foreground mt-1 text-xs">
        {review.author || 'Author not reported'}
        {review.publishedOn ? ` · ${review.publishedOn}` : ''}
      </Text>
      <Text className="mt-2 text-xs font-medium">{vehicleName}</Text>
      <Text className="text-muted-foreground mt-1 text-xs">
        {reviewKind(review.kind)}
      </Text>
      <View className="border-border mt-3 border-l-2 pl-3">
        <Text className="text-sm leading-6">{review.excerpt}</Text>
      </View>
      {review.conditions ? (
        <Text className="text-muted-foreground mt-3 text-xs leading-5">
          Conditions: {displayValue(review.conditions)}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Context and origin"
        accessibilityState={{ expanded: originOpen }}
        className="mt-2 min-h-11 flex-row items-center gap-1 self-start"
        onPress={() => setOriginOpen(!originOpen)}
      >
        <Icon
          as={originOpen ? ChevronDown : ChevronRight}
          className="text-foreground size-4"
        />
        <Text className="text-sm font-medium">Context and origin</Text>
      </Pressable>
      {originOpen ? (
        <View className="gap-2">
          {review.context ? (
            <Text className="text-xs leading-6">{review.context}</Text>
          ) : null}
          <Text className="text-muted-foreground text-xs">
            {review.locator || 'Location not reported'}
            {review.startSeconds != null ? ` · ${review.startSeconds}s` : ''}
          </Text>
          {href ? (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 self-start"
              accessibilityRole="link"
              accessibilityLabel="Open source (opens the browser)"
              onPress={() => onOpenLink(href)}
            >
              <Text>Open source ↗</Text>
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
