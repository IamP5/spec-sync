import { Directive, input, output } from '@angular/core';

import type {
  Comparison,
  VehicleConfiguration,
} from '../../data/vehicle-contracts';
import { catalogFact, identityLabel } from '../catalog-presentation';

/**
 * Shared contract of the two renderings of the loaded catalog page: the card
 * strip and the flush list. Both receive the configurations already filtered
 * and cut to the visible step by the card, and report the same intentions.
 */
@Directive()
export abstract class VehicleCatalogItems {
  readonly vehicles = input<VehicleConfiguration[]>([]);
  readonly summaries = input<Comparison>();
  readonly summariesLoading = input(false);
  readonly shortlistedConfigurations = input<VehicleConfiguration[]>([]);
  readonly vehicleSelected = output<VehicleConfiguration>();
  readonly shortlistToggled = output<VehicleConfiguration>();

  protected readonly identity = identityLabel;
  protected readonly metrics = [
    { label: 'Power', code: 'power_max' },
    { label: 'Torque', code: 'torque_max' },
    { label: 'Reference price', code: 'reference_price' },
  ] as const;

  protected image(vehicle: VehicleConfiguration) {
    return (
      vehicle.primaryImage ??
      this.summaries()?.configurations.find(({ id }) => id === vehicle.id)
        ?.primaryImage
    );
  }

  protected fact(vehicle: VehicleConfiguration, code: string) {
    return catalogFact(this.summaries(), vehicle.id, code);
  }
  protected isShortlisted(vehicle: VehicleConfiguration): boolean {
    return this.shortlistedConfigurations().some(({ id }) => id === vehicle.id);
  }
  protected toggle(event: Event, vehicle: VehicleConfiguration): void {
    event.stopPropagation();
    this.shortlistToggled.emit(vehicle);
  }
  protected detailsLabel(vehicle: VehicleConfiguration): string {
    return `Open ${vehicle.brand} ${vehicle.model} ${vehicle.name} details`;
  }
  protected shortlistLabel(vehicle: VehicleConfiguration): string {
    return this.isShortlisted(vehicle)
      ? `Remove ${vehicle.model} ${vehicle.name} from comparison`
      : `Add ${vehicle.model} ${vehicle.name} to comparison`;
  }
}
