import {
  BadgeCheck,
  CircleAlert,
  MessageCircle,
  RotateCcw,
  X,
} from 'lucide-react-native';
import { Pressable, ScrollView, View } from 'react-native';

import { Badge } from '../../../../design-system/components/ui/badge';
import { Button } from '../../../../design-system/components/ui/button';
import { Icon } from '../../../../design-system/components/ui/icon';
import { Skeleton } from '../../../../design-system/components/ui/skeleton';
import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import type {
  Comparison,
  VehicleConfiguration,
} from '../../data/vehicle-contracts';
import { VehicleImage } from '../../ui/vehicle-image';
import { catalogImage } from '../catalog-presentation';
import {
  detailFacts,
  factByCode,
  referencePriceContext,
} from '../vehicle-detail-presentation';
import { VehicleDetailTabs } from './vehicle-detail-tabs';

/**
 * The sheet content for one configuration (web `VehicleDetailPane`): photo,
 * identity, reference price with its date, and the sourced specifications in
 * Overview / Specifications / Evidence tabs. Uncertainty stays explicit.
 */
export function VehicleDetailPane({
  vehicle,
  comparison,
  loading,
  failed,
  onClose,
  onRetry,
  onAsk,
  onOpenLink,
}: {
  vehicle: VehicleConfiguration;
  comparison?: Comparison;
  loading: boolean;
  failed: boolean;
  onClose: () => void;
  onRetry: () => void;
  onAsk: () => void;
  onOpenLink: (url: string) => void;
}) {
  const image = catalogImage(vehicle, comparison);
  const facts = detailFacts(comparison, vehicle.id);
  const price = factByCode(facts, 'reference_price');
  const firstLoad = loading && !comparison;
  return (
    <View className="bg-background flex-1">
      <View className="border-border flex-row items-center justify-between border-b py-1 pr-1 pl-4">
        <Text className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
          Vehicle details
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close vehicle details"
          className="size-11 items-center justify-center rounded-full"
          onPress={onClose}
        >
          <Icon as={X} className="text-foreground size-5" />
        </Pressable>
      </View>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-5 p-4 pb-10"
      >
        <VehicleImage
          image={image}
          className="aspect-video w-full rounded-2xl"
          iconClassName="size-16"
        />
        <View className="gap-1">
          <View className="mb-1 flex-row flex-wrap gap-2">
            <Badge variant="outline">
              <Text>
                {vehicle.market} · {vehicle.modelYear}
              </Text>
            </Badge>
            {vehicle.identityStatus === 'PROVISIONAL' ? (
              <Badge variant="outline" className="border-warning/40">
                <Icon as={CircleAlert} className="text-warning size-3" />
                <Text>Provisional identity</Text>
              </Badge>
            ) : (
              <Badge variant="outline">
                <Icon as={BadgeCheck} className="text-success size-3" />
                <Text>
                  {vehicle.identityStatus === 'CONFIRMED'
                    ? 'Confirmed identity'
                    : 'Resolved from notes'}
                </Text>
              </Badge>
            )}
          </View>
          <Text className="text-muted-foreground text-sm font-medium">
            {vehicle.brand}
          </Text>
          <Text
            role="heading"
            className="text-2xl font-semibold tracking-tight"
          >
            {vehicle.model}
          </Text>
          <Text className="text-muted-foreground text-sm">{vehicle.name}</Text>
        </View>

        <View className="gap-3">
          <View>
            <Text className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Reference price
            </Text>
            {firstLoad ? (
              <View className="gap-2 pt-2">
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-3 w-64 max-w-full" />
              </View>
            ) : (
              <>
                <Text
                  className={cn(
                    'mt-1 text-xl font-semibold tracking-tight',
                    price.status === 'conflicting' && 'text-warning',
                    price.status === 'not-reported' && 'text-muted-foreground',
                  )}
                >
                  {price.value}
                </Text>
                <Text className="text-muted-foreground mt-1 text-xs leading-5">
                  {referencePriceContext(comparison, vehicle.id)}
                </Text>
              </>
            )}
          </View>
          <Button
            variant="outline"
            className="min-h-11"
            accessibilityLabel="Ask about this vehicle"
            onPress={onAsk}
          >
            <Icon as={MessageCircle} className="size-4" />
            <Text>Ask about this vehicle</Text>
          </Button>
        </View>

        {failed ? (
          <View
            accessibilityRole="alert"
            className="border-destructive/35 bg-destructive/5 gap-1 rounded-xl border p-4"
          >
            <Text className="text-sm font-medium">
              Vehicle details are unavailable
            </Text>
            <Text className="text-muted-foreground text-sm leading-6">
              The catalog identity is still available, but its sourced
              specifications could not be loaded.
            </Text>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 min-h-11 self-start"
              accessibilityLabel="Try again"
              onPress={onRetry}
            >
              <Icon as={RotateCcw} className="size-4" />
              <Text>Try again</Text>
            </Button>
          </View>
        ) : firstLoad ? (
          <View
            className="gap-4"
            accessibilityLabel="Loading vehicle specifications"
          >
            <View className="flex-row gap-5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </View>
            <View className="flex-row gap-3">
              <Skeleton className="h-24 flex-1 rounded-xl" />
              <Skeleton className="h-24 flex-1 rounded-xl" />
            </View>
            <Skeleton className="h-28 rounded-xl" />
          </View>
        ) : (
          <VehicleDetailTabs
            vehicle={vehicle}
            facts={facts}
            comparison={comparison}
            image={image}
            onOpenLink={onOpenLink}
          />
        )}
      </ScrollView>
    </View>
  );
}
