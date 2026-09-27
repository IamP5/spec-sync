import { Check, Plus } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from '../../../../design-system/components/ui/icon';
import { Text } from '../../../../design-system/components/ui/text';
import { cn } from '../../../../design-system/lib/utils';
import type {
  Comparison,
  VehicleConfiguration,
} from '../../data/vehicle-contracts';
import { type CatalogFact, catalogFact } from '../catalog-presentation';

/**
 * The shared contract of the two renderings of the loaded catalog page (the
 * card strip and the flush list, web `VehicleCatalogItems`): both receive
 * the configurations already filtered and cut to the visible step.
 */
export interface VehicleCatalogItemsProps {
  vehicles: VehicleConfiguration[];
  summaries?: Comparison;
  summariesLoading: boolean;
  shortlistedIds: ReadonlySet<string>;
  onVehicleSelected: (vehicle: VehicleConfiguration) => void;
  onShortlistToggled: (vehicle: VehicleConfiguration) => void;
}

export function detailsLabel(vehicle: VehicleConfiguration): string {
  return `Open ${vehicle.brand} ${vehicle.model} ${vehicle.name} details`;
}

export function shortlistLabel(
  vehicle: VehicleConfiguration,
  shortlisted: boolean,
): string {
  const name = `${vehicle.model} ${vehicle.name}`;
  return shortlisted
    ? `Remove ${name} from comparison`
    : `Add ${name} to comparison`;
}

export function factOf(
  summaries: Comparison | undefined,
  vehicle: VehicleConfiguration,
  code: string,
): CatalogFact {
  return catalogFact(summaries, vehicle.id, code);
}

/** A highlight value; conflicting values read in the warning tone. */
export function FactText({
  fact,
  emphasis = false,
  className,
}: {
  fact: CatalogFact;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <Text
      numberOfLines={1}
      className={cn(
        'text-xs tabular-nums',
        fact.status === 'conflicting'
          ? 'text-warning'
          : emphasis && fact.status === 'known'
            ? 'text-foreground font-medium'
            : 'text-muted-foreground',
        className,
      )}
    >
      {fact.text}
    </Text>
  );
}

/** Adds a configuration to the comparison shortlist or removes it. */
export function ShortlistToggle({
  vehicle,
  shortlisted,
  onToggle,
  overlay = false,
}: {
  vehicle: VehicleConfiguration;
  shortlisted: boolean;
  onToggle: (vehicle: VehicleConfiguration) => void;
  /** Drawn over a photo: a translucent surface keeps it legible. */
  overlay?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shortlistLabel(vehicle, shortlisted)}
      accessibilityState={{ selected: shortlisted }}
      className="size-11 items-center justify-center"
      onPress={() => onToggle(vehicle)}
    >
      <View
        className={cn(
          'size-8 items-center justify-center rounded-full border',
          shortlisted
            ? 'border-primary bg-primary'
            : overlay
              ? 'border-foreground/10 bg-background/80'
              : 'border-border bg-background',
        )}
      >
        <Icon
          as={shortlisted ? Check : Plus}
          className={cn(
            'size-4',
            shortlisted ? 'text-primary-foreground' : 'text-foreground',
          )}
        />
      </View>
    </Pressable>
  );
}
