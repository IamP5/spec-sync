import { Directive, inject, input, LOCALE_ID, output } from '@angular/core';

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

  private readonly locale = inject(LOCALE_ID);
  protected readonly identity = identityLabel;
  protected readonly metrics = [
    { label: $localize`Power`, code: 'power_max' },
    { label: $localize`Torque`, code: 'torque_max' },
    { label: $localize`Reference price`, code: 'reference_price' },
  ] as const;

  protected image(vehicle: VehicleConfiguration) {
    return (
      vehicle.primaryImage ??
      this.summaries()?.configurations.find(({ id }) => id === vehicle.id)
        ?.primaryImage
    );
  }

  protected fact(vehicle: VehicleConfiguration, code: string) {
    return catalogFact(this.summaries(), vehicle.id, code, this.locale);
  }
  protected isShortlisted(vehicle: VehicleConfiguration): boolean {
    return this.shortlistedConfigurations().some(({ id }) => id === vehicle.id);
  }
  protected toggle(event: Event, vehicle: VehicleConfiguration): void {
    event.stopPropagation();
    this.shortlistToggled.emit(vehicle);
  }
  protected detailsLabel(vehicle: VehicleConfiguration): string {
    const name = `${vehicle.brand} ${vehicle.model} ${vehicle.name}`;
    return $localize`Open ${name}:vehicle: details`;
  }
  protected shortlistLabel(vehicle: VehicleConfiguration): string {
    const name = `${vehicle.model} ${vehicle.name}`;
    return this.isShortlisted(vehicle)
      ? $localize`Remove ${name}:vehicle: from comparison`
      : $localize`Add ${name}:vehicle: to comparison`;
  }
}
