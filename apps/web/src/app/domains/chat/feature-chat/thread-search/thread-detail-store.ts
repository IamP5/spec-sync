import { inject } from '@angular/core';
import {
  rxMutation,
  withDevtools,
  withMutations,
} from '@angular-architects/ngrx-toolkit';
import { signalStore, withProps } from '@ngrx/signals';

import { ThreadClient } from '../../data/thread-client';

/**
 * Stored-thread mutations against the AI service; the coordinator refreshes
 * the search state after every write.
 */
export const ThreadDetailStore = signalStore(
  { providedIn: 'root' },
  withProps(() => ({ _client: inject(ThreadClient) })),
  withMutations((store) => ({
    rename: rxMutation({
      operation: (input: { id: string; title: string }) =>
        store._client.rename(input.id, input.title),
    }),
    remove: rxMutation({ operation: (id: string) => store._client.remove(id) }),
    clear: rxMutation({ operation: (_: void) => store._client.clear() }),
  })),
  withDevtools('threadDetail'),
);
