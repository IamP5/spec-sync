import { inject } from '@angular/core';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { GreetingClient } from '../../data/greeting-client';

/**
 * Detail store for a single greeting. Reference implementation for stores in
 * this repository (see apps/web/docs/architecture-state-management.md).
 */
export const GreetingDetailStore = signalStore(
  { providedIn: 'root' },

  withState({
    /** The name that was actually submitted; drives the request. */
    name: '',
  }),

  withProps(() => ({
    _greetingClient: inject(GreetingClient),
  })),

  withResource((store) => ({
    greeting: store._greetingClient.greetingResource(store.name),
  })),

  withMethods((store) => ({
    /**
     * Requests the greeting for `name`. Submitting the same name again
     * reloads, because the resource would not re-run on identical params.
     */
    load(name: string): void {
      if (store.name() === name) {
        store._greetingReload();
      } else {
        patchState(store, { name });
      }
    },
  })),

  withDevtools('greetingDetail'),
);
