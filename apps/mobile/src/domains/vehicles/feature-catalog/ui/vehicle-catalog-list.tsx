import { Pressable, View } from 'react-native';

import { Badge } from '../../../../design-system/components/ui/badge';
import { Skeleton } from '../../../../design-system/components/ui/skeleton';
import { Text } from '../../../../design-system/components/ui/text';
import { VehicleImage } from '../../ui/vehicle-image';
import {
  CATALOG_METRICS,
  catalogImage,
  identityLabel,
} from '../catalog-presentation';
import {
  detailsLabel,
  factOf,
  FactText,
  ShortlistToggle,
  type VehicleCatalogItemsProps,
} from './vehicle-catalog-parts';

/**
 * The loaded page as a flush list (web `VehicleCatalogList`): one hairline
 * row per configuration with its key facts. The rows are revealed in steps
 * by the card, so the list stays short inside the chat transcript.
 */
export function VehicleCatalogList({
  vehicles,
  summaries,
  summariesLoading,
  shortlistedIds,
  onVehicleSelected,
  onShortlistToggled,
}: VehicleCatalogItemsProps) {
  return (
    <View accessibilityRole="list">
      {vehicles.map((vehicle, index) => {
        const identity = identityLabel(vehicle);
        return (
          <View
            key={vehicle.id}
            className={
              index === 0
                ? 'flex-row items-center gap-2 py-2'
                : 'border-border flex-row items-center gap-2 border-t py-2'
            }
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={detailsLabel(vehicle)}
              className="min-h-11 flex-1 flex-row items-center gap-3"
              onPress={() => onVehicleSelected(vehicle)}
            >
              <VehicleImage
                compact
                image={catalogImage(vehicle, summaries)}
                className="aspect-video w-20 rounded-lg"
              />
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-2">
                  <Text
                    numberOfLines={1}
                    className="shrink text-sm font-medium"
                  >
                    {vehicle.model}{' '}
                    <Text className="text-muted-foreground text-sm font-normal">
                      {vehicle.name}
                    </Text>
                  </Text>
                  {identity ? (
                    <Badge variant="outline" className="px-1.5 py-0">
                      <Text className="text-muted-foreground text-xs">
                        {identity}
                      </Text>
                    </Badge>
                  ) : null}
                </View>
                <Text
                  numberOfLines={1}
                  className="text-muted-foreground mt-0.5 text-xs"
                >
                  {vehicle.brand} · {vehicle.market} · {vehicle.modelYear}
                </Text>
                {summariesLoading && !summaries ? (
                  <Skeleton className="mt-1 h-3 w-40" />
                ) : (
                  <View className="mt-0.5 flex-row flex-wrap gap-x-2">
                    {CATALOG_METRICS.map((metric) => (
                      <FactText
                        key={metric.code}
                        emphasis={metric.code === 'reference_price'}
                        fact={factOf(summaries, vehicle, metric.code)}
                      />
                    ))}
                  </View>
                )}
              </View>
            </Pressable>
            <ShortlistToggle
              vehicle={vehicle}
              shortlisted={shortlistedIds.has(vehicle.id)}
              onToggle={onShortlistToggled}
            />
          </View>
        );
      })}
    </View>
  );
}
