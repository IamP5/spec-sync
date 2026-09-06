import { inject } from '@angular/core';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import { signalStore, withMethods, withProps } from '@ngrx/signals';

import { ThreadClient } from '../../data/thread-client';

/** Stored-thread mutations; the coordinator refreshes search state after writes. */
export const ThreadDetailStore = signalStore(
  { providedIn: 'root' },
  withProps(() => ({ _client: inject(ThreadClient) })),
  withMethods((store) => ({
    rename(id: string, title: string): void {
      store._client.rename(id, title);
    },
    remove(id: string): void {
      store._client.remove(id);
    },
    clear(): void {
      store._client.clear();
    },
  })),
  withDevtools('threadDetail'),
);
