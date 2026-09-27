import { computed, inject } from '@angular/core';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { SESSION } from '../../auth/api/session';
import { ingestionAccessMessage } from '../data/ingestion-access';
import { IngestionClient } from '../data/ingestion-client';

/** The curator's runs, newest first; reloads when the session changes or on demand. */
export const IngestionSearchStore = signalStore(
  withState({ version: 0 }),
  withProps(() => ({
    _client: inject(IngestionClient),
    _auth: inject(SESSION),
  })),
  withComputed((store) => ({ signedIn: store._auth.authenticated })),
  withResource((store) => ({
    runs: store._client.listResource(store.version),
  })),
  withComputed((store) => ({
    /** Why the list failed: the API's 401/403 explained, else a generic hint. */
    runsFailure: computed(() => {
      const error = store.runsError();
      return error
        ? (ingestionAccessMessage(error) ??
            $localize`Could not load the imports. Refresh to try again.`)
        : '';
    }),
  })),
  withMethods((store) => ({
    reload() {
      patchState(store, { version: store.version() + 1 });
    },
  })),
  withDevtools('ingestionSearch'),
);
