import { ArrowRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';

import { Icon } from '../../../../design-system/components/ui/icon';
import { Skeleton } from '../../../../design-system/components/ui/skeleton';
import { Text } from '../../../../design-system/components/ui/text';
import type {
  Comparison,
  VehicleConfiguration,
} from '../../data/vehicle-contracts';
import { VehicleImage } from '../../ui/vehicle-image';
import { catalogImage, identityLabel } from '../catalog-presentation';
import {
  detailsLabel,
  factOf,
  FactText,
  ShortlistToggle,
  type VehicleCatalogItemsProps,
} from './vehicle-catalog-parts';

/**
 * The loaded page as a horizontal strip of compact cards (web
 * `VehicleCatalogStrip`). The strip ends with a card that reveals the next
 * step of the page or asks for the next catalog page, so it never grows on
 * its own.
 */
export function VehicleCatalogStrip({
  vehicles,
  summaries,
  summariesLoading,
  shortlistedIds,
  onVehicleSelected,
  onShortlistToggled,
  hidden,
  nextPageSize,
  nextPageLoading,
  onMore,
  onNextPage,
}: VehicleCatalogItemsProps & {
  /** Configurations of the loaded page still hidden behind "show more". */
  hidden: number;
  /** Size of the next catalog page to offer; zero hides the offer. */
  nextPageSize: number;
  nextPageLoading: boolean;
  onMore: () => void;
  onNextPage: () => void;
}) {
  return (
    <FlatList
      horizontal
      data={vehicles}
      keyExtractor={keyOf}
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-3 px-4"
      className="-mx-4"
      renderItem={({ item }) => (
        <StripCard
          vehicle={item}
          summaries={summaries}
          summariesLoading={summariesLoading}
          shortlisted={shortlistedIds.has(item.id)}
          onVehicleSelected={onVehicleSelected}
          onShortlistToggled={onShortlistToggled}
        />
      )}
      ListFooterComponent={
        hidden ? (
          <EndCard accessibilityLabel={`Show ${hidden} more`} onPress={onMore}>
            <Text className="text-lg font-semibold">+{hidden}</Text>
            <Text className="text-muted-foreground text-xs">more</Text>
          </EndCard>
        ) : nextPageSize ? (
          <EndCard
            accessibilityLabel={`Load next ${nextPageSize} from the catalog`}
            busy={nextPageLoading}
            onPress={onNextPage}
          >
            {nextPageLoading ? (
              <ActivityIndicator size="small" />
            ) : (
              <Icon as={ArrowRight} className="text-foreground size-4" />
            )}
            <Text className="text-xs font-medium">
              {nextPageLoading ? 'Loading…' : `Load next ${nextPageSize}`}
            </Text>
            <Text className="text-muted-foreground text-xs">
              from the catalog
            </Text>
          </EndCard>
        ) : null
      }
    />
  );
}

function keyOf(vehicle: VehicleConfiguration): string {
  return vehicle.id;
}

function StripCard({
  vehicle,
  summaries,
  summariesLoading,
  shortlisted,
  onVehicleSelected,
  onShortlistToggled,
}: {
  vehicle: VehicleConfiguration;
  summaries?: Comparison;
  summariesLoading: boolean;
  shortlisted: boolean;
  onVehicleSelected: (vehicle: VehicleConfiguration) => void;
  onShortlistToggled: (vehicle: VehicleConfiguration) => void;
}) {
  const identity = identityLabel(vehicle);
  return (
    <View className="w-56">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={detailsLabel(vehicle)}
        onPress={() => onVehicleSelected(vehicle)}
      >
        <VehicleImage
          image={catalogImage(vehicle, summaries)}
          className="aspect-video w-full rounded-2xl"
          iconClassName="size-8"
        />
        <View className="mt-2 px-1">
          <Text numberOfLines={1} className="text-muted-foreground text-xs">
            {vehicle.brand} · {vehicle.modelYear}
            {identity ? ` · ${identity}` : ''}
          </Text>
          <Text numberOfLines={1} className="text-sm font-medium">
            {vehicle.model} {vehicle.name}
          </Text>
          {summariesLoading && !summaries ? (
            <View className="gap-1.5 pt-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-24" />
            </View>
          ) : (
            <>
              <View className="mt-1 flex-row gap-1">
                <FactText fact={factOf(summaries, vehicle, 'power_max')} />
                <Text className="text-muted-foreground text-xs">·</Text>
                <FactText fact={factOf(summaries, vehicle, 'torque_max')} />
              </View>
              <FactText
                emphasis
                className="text-sm"
                fact={factOf(summaries, vehicle, 'reference_price')}
              />
            </>
          )}
        </View>
      </Pressable>
      <View className="absolute top-0 right-0">
        <ShortlistToggle
          overlay
          vehicle={vehicle}
          shortlisted={shortlisted}
          onToggle={onShortlistToggled}
        />
      </View>
    </View>
  );
}

function EndCard({
  accessibilityLabel,
  busy = false,
  onPress,
  children,
}: {
  accessibilityLabel: string;
  busy?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      className="border-border aspect-video w-40 items-center justify-center gap-0.5 rounded-2xl border border-dashed px-3"
      onPress={onPress}
    >
      {children}
    </Pressable>
  );
}
