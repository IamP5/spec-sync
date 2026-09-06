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

export const VehicleCatalogSearchStore = signalStore(
  withState({ configurationIds: [] as string[] }),
  withProps(() => ({ _client: inject(VehicleCatalogClient) })),
  withResource((store) => ({
    summaries: store._client.summariesResource(store.configurationIds),
  })),
  withMethods((store) => ({
    load(configurationIds: string[]): void {
      patchState(store, { configurationIds });
    },
    retry(): void {
      store._summariesReload();
    },
  })),
  withDevtools('vehicleCatalogSearch'),
);
