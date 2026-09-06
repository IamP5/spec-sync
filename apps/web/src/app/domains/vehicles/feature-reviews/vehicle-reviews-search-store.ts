import { inject } from '@angular/core';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import type { ReviewQuery } from '../data/vehicle-reviews';
import { VehicleReviewsClient } from '../data/vehicle-reviews-client';

/** Dialog-scoped search state; requests cancel when the dialog is destroyed. */
export const VehicleReviewsSearchStore = signalStore(
  withState({ query: undefined as ReviewQuery | undefined }),
  withProps(() => ({ _client: inject(VehicleReviewsClient) })),
  withResource((store) => ({
    reviews: store._client.relatedResource(store.query),
  })),
  withMethods((store) => ({
    load(query: ReviewQuery) {
      patchState(store, { query });
    },
    retry() {
      const query = store.query();
      if (query) patchState(store, { query: { ...query } });
    },
  })),
  withDevtools('vehicleReviewsSearch'),
);
