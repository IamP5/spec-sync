import { inject } from '@angular/core';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { CuratorSessionClient } from '../data/curator-session-client';
import { IngestionClient } from '../data/ingestion-client';

/** The curator's runs, newest first; reloads when the key changes or on demand. */
export const IngestionSearchStore = signalStore(
  withState({ version: 0 }),
  withProps(() => ({
    _client: inject(IngestionClient),
    _session: inject(CuratorSessionClient),
  })),
  withComputed((store) => ({ hasKey: store._session.hasKey })),
  withResource((store) => ({
    runs: store._client.listResource(store._session.key, store.version),
  })),
  withMethods((store) => ({
    reload() {
      patchState(store, { version: store.version() + 1 });
    },
    setKey(key: string) {
      store._session.set(key);
    },
  })),
  withDevtools('ingestionSearch'),
);
