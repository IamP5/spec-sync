import { inject } from '@angular/core';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import type { UserConfiguration } from '../data/user';
import { UserClient } from '../data/user-client';

export const UserConfigurationStore = signalStore(
  { providedIn: 'root' },
  withState<{ uid: string; configuration: UserConfiguration; error: string }>({
    uid: '',
    configuration: { theme: 'system' },
    error: '',
  }),
  withProps(() => ({ _client: inject(UserClient) })),
  withMethods((store) => ({
    load(uid: string) {
      patchState(store, {
        uid,
        configuration: store._client.configuration(uid),
        error: '',
      });
    },
    update(configuration: UserConfiguration) {
      try {
        store._client.saveConfiguration(store.uid(), configuration);
        patchState(store, { configuration, error: '' });
      } catch {
        patchState(store, {
          error: 'Your browser could not save this preference.',
        });
      }
    },
  })),
  withDevtools('userConfiguration'),
);
