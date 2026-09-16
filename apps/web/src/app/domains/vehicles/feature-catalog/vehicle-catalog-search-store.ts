import { computed, inject, linkedSignal } from '@angular/core';
import {
  exhaustOp,
  rxMutation,
  withDevtools,
  withMutations,
  withResource,
} from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withComputed,
  withLinkedState,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { forkJoin, map } from 'rxjs';

import { VehicleCatalogClient } from '../data/vehicle-catalog-client';
import type {
  CatalogPage,
  CatalogSearch,
  Comparison,
  VehicleConfiguration,
} from '../data/vehicle-contracts';

/**
 * The list of one rendered catalog: the page the tool returned plus the
 * continuation pages the reader loads in place, and the highlights of all
 * of them. Paging is a catalog interaction, so it never goes through the
 * agent: the next pages come straight from the catalog API.
 */
export const VehicleCatalogSearchStore = signalStore(
  withState({
    /** Configurations of the page as the tool returned it. */
    configurationIds: [] as string[],
    /** Configurations appended by "load next", in the order they arrived. */
    continuation: [] as VehicleConfiguration[],
    /** Where the next "load next" continues; empty once the catalog is exhausted. */
    nextSearches: [] as CatalogSearch[],
    /** Bumped by every new page so a late answer for a replaced page is dropped. */
    generation: 0,
    nextPageFailed: false,
  }),
  withProps(() => ({ _client: inject(VehicleCatalogClient) })),
  withComputed((store) => ({
    allConfigurationIds: computed(() => [
      ...store.configurationIds(),
      ...store.continuation().map(({ id }) => id),
    ]),
  })),
  withResource((store) => ({
    summaries: store._client.summariesResource(store.allConfigurationIds),
  })),
  withLinkedState((store) => ({
    /** The highlights stay on screen while the list grows and reloads them. */
    highlights: linkedSignal<Comparison | undefined, Comparison | undefined>({
      source: store.summariesValue,
      computation: (value, previous) => value ?? previous?.value,
    }),
  })),
  withMutations((store) => ({
    nextPage: rxMutation({
      operator: exhaustOp,
      operation: ({
        searches,
        generation,
      }: {
        searches: CatalogSearch[];
        generation: number;
      }) =>
        forkJoin(
          searches.map((search) =>
            store._client
              .searchConfigurations(search)
              .pipe(map((page) => ({ search, page }))),
          ),
        ).pipe(map((results) => ({ results, generation }))),
      onSuccess: ({ results, generation }) => {
        if (generation !== store.generation()) return;
        const known = new Set(store.allConfigurationIds());
        const appended: VehicleConfiguration[] = [];
        const nextSearches: CatalogSearch[] = [];
        for (const { search, page } of results) {
          for (const vehicle of page.items) {
            if (known.has(vehicle.id)) continue;
            known.add(vehicle.id);
            appended.push(vehicle);
          }
          if (page.hasMore)
            nextSearches.push({
              ...search,
              offset: page.offset + page.items.length,
            });
        }
        patchState(store, {
          continuation: [...store.continuation(), ...appended],
          nextSearches,
          nextPageFailed: false,
        });
      },
      onError: (_error, { generation }) => {
        if (generation === store.generation())
          patchState(store, { nextPageFailed: true });
      },
    }),
  })),
  withMethods((store) => ({
    load(page: CatalogPage): void {
      patchState(store, {
        configurationIds: page.items.map(({ id }) => id),
        continuation: [],
        nextSearches: page.nextSearches ?? [],
        generation: store.generation() + 1,
        nextPageFailed: false,
      });
    },
    loadNextPage(): void {
      const searches = store.nextSearches();
      if (!searches.length || store.nextPageIsPending()) return;
      void store.nextPage({ searches, generation: store.generation() });
    },
    retry(): void {
      store._summariesReload();
    },
  })),
  withDevtools('vehicleCatalogSearch'),
);
