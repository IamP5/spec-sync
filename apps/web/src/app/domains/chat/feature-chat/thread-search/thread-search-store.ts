import { computed, inject } from '@angular/core';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
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
import { SESSION } from '../../../auth/api/session';
import {
  ChatThreadSummary,
  groupThreads,
  matchesQuery,
} from '../../data/thread';
import { ThreadClient } from '../../data/thread-client';

/**
 * Search store of the conversation history shown in the sidebar: the stored
 * threads, the filter typed into the search box and the date sections they
 * are shown in. The history changes whenever the open conversation does;
 * the chat coordinator calls `load()` after each of those changes.
 */
export const ThreadSearchStore = signalStore(
  { providedIn: 'root' },

  withState({
    threads: [] as ChatThreadSummary[],
    query: '',
    /** Moment of the last load; the date sections are computed against it. */
    loadedAt: 0,
  }),

  withProps(() => ({
    _threadClient: inject(ThreadClient),
    _session: inject(SESSION),
  })),

  withComputed((store) => ({
    groups: computed(() =>
      groupThreads(
        store.threads().filter((thread) => matchesQuery(thread, store.query())),
        store.loadedAt(),
      ),
    ),
    isEmpty: computed(() => store.threads().length === 0),
  })),

  withMethods((store) => ({
    /** Reads the history again. */
    load(): void {
      patchState(store, {
        threads: store._session.authenticated()
          ? store._threadClient.list()
          : [],
        loadedAt: Date.now(),
      });
    },

    setQuery(query: string): void {
      patchState(store, { query });
    },
  })),

  withReducer(
    on(sessionEvents.invalidated, () => ({
      threads: [],
      query: '',
      loadedAt: 0,
    })),
  ),
  withEventHandlers((store, events = inject(Events)) => ({
    session: events.on(sessionEvents.established).pipe(
      tap(() => store.load()),
      ignoreElements(),
    ),
  })),
  withHooks({
    onInit(store) {
      store.load();
    },
  }),

  withDevtools('threadSearch'),
);
