import { inject } from '@angular/core';
import {
  rxMutation,
  withDevtools,
  withMutations,
} from '@angular-architects/ngrx-toolkit';
import { signalStore, withProps } from '@ngrx/signals';
import { injectDispatch } from '@ngrx/signals/events';

import { ThreadClient } from '../../data/thread-client';
import { threadEvents } from '../../data/thread-events';

/**
 * Stored-thread mutations against the AI service. Every confirmed write is
 * announced through `threadEvents`, which is how the cached thread list
 * follows it without reading the history again.
 */
export const ThreadDetailStore = signalStore(
  { providedIn: 'root' },
  withProps(() => ({
    _client: inject(ThreadClient),
    _dispatch: injectDispatch(threadEvents),
  })),
  withMutations((store) => ({
    rename: rxMutation({
      operation: (input: { id: string; title: string }) =>
        store._client.rename(input.id, input.title),
      onSuccess: (thread) => store._dispatch.renamed(thread),
    }),
    remove: rxMutation({
      operation: (id: string) => store._client.remove(id),
      onSuccess: (_, id) => store._dispatch.removed(id),
    }),
    clear: rxMutation({
      operation: (_: void) => store._client.clear(),
      onSuccess: () => store._dispatch.cleared(),
    }),
  })),
  withDevtools('threadDetail'),
);
