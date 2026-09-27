import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import type { VehicleConfiguration } from '../../data/vehicle-contracts';

/**
 * The catalog footer: paging through the loaded page and the catalog, and
 * the comparison shortlist with its one primary action.
 */
export function VehicleCatalogFooter({
  step,
  expanded,
  nextPageSize,
  nextPageLoading,
  nextPageFailed,
  shortlisted,
  onMore,
  onLess,
  onNextPage,
  onCompare,
}: {
  /** How many more configurations "show more" reveals; zero hides it. */
  step: number;
  expanded: boolean;
  nextPageSize: number;
  nextPageLoading: boolean;
  nextPageFailed: boolean;
  shortlisted: VehicleConfiguration[];
  onMore: () => void;
  onLess: () => void;
  onNextPage: () => void;
  onCompare: () => void;
}) {
  return (
    <View className="border-border mt-3 gap-2 border-t pt-2">
      <View className="flex-row flex-wrap items-center gap-2">
        {step ? (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11"
            accessibilityLabel={`Show ${step} more`}
            onPress={onMore}
          >
            <Icon as={ChevronDown} className="size-4" />
            <Text className="text-xs">Show {step} more</Text>
          </Button>
        ) : expanded ? (
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11"
            accessibilityLabel="Show less"
            onPress={onLess}
          >
            <Icon as={ChevronUp} className="size-4" />
            <Text className="text-xs">Show less</Text>
          </Button>
        ) : null}
        {nextPageSize ? (
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 rounded-full"
            disabled={nextPageLoading}
            accessibilityLabel={
              nextPageLoading
                ? 'Loading more from the catalog'
                : `Load next ${nextPageSize} from the catalog`
            }
            accessibilityState={{ busy: nextPageLoading }}
            onPress={onNextPage}
          >
            {nextPageLoading ? <ActivityIndicator size="small" /> : null}
            <Text className="text-xs">
              {nextPageLoading
                ? 'Loading more from the catalog…'
                : `Load next ${nextPageSize} from the catalog`}
            </Text>
            {nextPageLoading ? null : (
              <Icon as={ArrowRight} className="size-4" />
            )}
          </Button>
        ) : null}
      </View>
      {nextPageFailed ? (
        <Text accessibilityRole="alert" className="text-destructive text-xs">
          Could not load more of the catalog.
        </Text>
      ) : null}
      {shortlisted.length ? (
        <View className="flex-row items-center gap-3">
          <Text
            className="text-muted-foreground flex-1 text-xs"
            numberOfLines={2}
          >
            <Text className="text-foreground text-xs font-medium">
              {shortlisted.length} selected
            </Text>
            {' · '}
            {shortlisted
              .map((vehicle) => `${vehicle.model} ${vehicle.name}`)
              .join(', ')}
          </Text>
          <Button
            size="sm"
            className="min-h-11 rounded-full"
            disabled={shortlisted.length < 2}
            accessibilityLabel="Compare in chat"
            onPress={onCompare}
          >
            <Text className="text-xs">Compare in chat</Text>
            <Icon as={ArrowRight} className="size-4" />
          </Button>
        </View>
      ) : (
        <Text className="text-muted-foreground text-xs">
          Tap a vehicle for specifications. Add two or more to compare.
        </Text>
      )}
    </View>
  );
}
