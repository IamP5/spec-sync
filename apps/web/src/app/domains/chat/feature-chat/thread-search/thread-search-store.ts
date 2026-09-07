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
import {
  Events,
  on,
  withEventHandlers,
  withReducer,
} from '@ngrx/signals/events';
import { ignoreElements, tap } from 'rxjs';

import { sessionEvents } from '../../../auth/api/events';
import { groupThreads, matchesQuery } from '../../data/thread';
import { ThreadClient } from '../../data/thread-client';

/**
 * Search store of the conversation history shown in the sidebar: the threads
 * the AI service stores for the signed-in user, the filter typed into the
 * search box and the date sections they are shown in. Titles are written by
 * the service after a run, so the chat coordinator calls `load()` after each
 * change to the open conversation.
 */
export const ThreadSearchStore = signalStore(
  { providedIn: 'root' },

  withState({
    query: '',
    /** Moment of the last load; the date sections are computed against it. */
    loadedAt: 0,
  }),

  withProps(() => ({ _threadClient: inject(ThreadClient) })),

  withResource((store) => ({ threads: store._threadClient.listResource() })),

  withComputed((store) => ({
    groups: computed(() =>
      groupThreads(
        (store.threadsValue() ?? []).filter((thread) =>
          matchesQuery(thread, store.query()),
        ),
        store.loadedAt(),
      ),
    ),
    isEmpty: computed(() => (store.threadsValue() ?? []).length === 0),
  })),

  withMethods((store) => ({
    /** Reads the history again. */
    load(): void {
      patchState(store, { loadedAt: Date.now() });
      store._threadsReload();
    },

    setQuery(query: string): void {
      patchState(store, { query });
    },
  })),

  withReducer(
    on(sessionEvents.invalidated, () => ({
      query: '',
      loadedAt: 0,
      threadsValue: [],
    })),
  ),
  withEventHandlers((store, events = inject(Events)) => ({
    session: events.on(sessionEvents.established, sessionEvents.refreshed).pipe(
      tap(() => store.load()),
      ignoreElements(),
    ),
  })),

  withDevtools('threadSearch'),
);
