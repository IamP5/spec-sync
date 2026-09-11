import { inject } from '@angular/core';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { VehicleCatalogClient } from '../data/vehicle-catalog-client';

export const VehicleComparisonLookupStore = signalStore(
  withState({ configurationIds: [] as string[] }),
  withProps(() => ({ _client: inject(VehicleCatalogClient) })),
  withResource((store) => ({
    images: store._client.imagesResource(store.configurationIds),
  })),
  withMethods((store) => ({
    load(configurationIds: string[]): void {
      patchState(store, { configurationIds });
    },
    retry(): void {
      store._imagesReload();
    },
  })),
  withDevtools('vehicleComparisonLookup'),
);
