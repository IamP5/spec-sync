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

export const VehicleCatalogDetailStore = signalStore(
  withState({ configurationId: undefined as string | undefined }),
  withProps(() => ({ _client: inject(VehicleCatalogClient) })),
  withResource((store) => ({
    detail: store._client.detailResource(store.configurationId),
  })),
  withMethods((store) => ({
    load(configurationId: string): void {
      patchState(store, { configurationId });
    },
    retry(): void {
      store._detailReload();
    },
  })),
  withDevtools('vehicleCatalogDetail'),
);
