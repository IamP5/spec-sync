import { Pressable, View } from 'react-native';

import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import type {
  VehicleConfiguration,
  VehicleImageMetadata,
} from '../../data/vehicle-contracts';
import { VehicleImage } from '../../ui/vehicle-image';

export function nameToggleLabel(configuration: VehicleConfiguration): string {
  return `Show the name of ${configuration.model} ${configuration.name} next to the values`;
}

/**
 * The compared vehicles, numbered once (web comparison legend). Tapping a
 * number names that vehicle next to each of its values.
 */
export function VehicleComparisonLegend({
  configurations,
  images,
  numbered,
  named,
  onToggleName,
}: {
  configurations: VehicleConfiguration[];
  images?: Record<string, VehicleImageMetadata | null>;
  numbered: boolean;
  named: ReadonlySet<string>;
  onToggleName: (configurationId: string) => void;
}) {
  return (
    <View className="mt-1 gap-2 py-2" accessibilityLabel="Compared vehicles">
      {configurations.map((configuration, index) => (
        <View key={configuration.id} className="flex-row items-center gap-2">
          <VehicleImage
            compact
            image={configuration.primaryImage ?? images?.[configuration.id]}
            className="h-12 w-20 rounded-lg"
          />
          {numbered ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={nameToggleLabel(configuration)}
              accessibilityState={{ selected: named.has(configuration.id) }}
              className="size-11 items-center justify-center"
              onPress={() => onToggleName(configuration.id)}
            >
              <View className="bg-foreground size-6 items-center justify-center rounded-full">
                <Text className="text-background text-xs font-semibold">
                  {index + 1}
                </Text>
              </View>
            </Pressable>
          ) : null}
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="text-sm font-medium">
              {configuration.model} {configuration.name}
            </Text>
            <Text
              numberOfLines={2}
              className={cn('text-muted-foreground text-xs')}
            >
              {configuration.brand} · {configuration.modelYear} ·{' '}
              {configuration.market}
              {configuration.identityStatus !== 'CONFIRMED'
                ? ' · version to confirm'
                : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
