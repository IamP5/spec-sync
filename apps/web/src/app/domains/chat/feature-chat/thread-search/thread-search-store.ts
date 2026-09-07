import { computed, inject, linkedSignal } from '@angular/core';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withComputed,
  withLinkedState,
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
import {
  ChatThreadSummary,
  groupThreads,
  matchesQuery,
} from '../../data/thread';
import { ThreadClient } from '../../data/thread-client';
import { threadEvents } from '../../data/thread-events';

/**
 * Search store of the conversation history shown in the sidebar: the threads
 * the AI service stores for the signed-in user, the filter typed into the
 * search box and the date sections they are shown in.
 *
 * The list is read once per session (`history`) and then kept as a cache
 * (`threads`): the reducers below apply every change the browser makes
 * (`threadEvents`) to the cache, so no change needs another read. `load()`
 * reads the service again and its answer replaces the cache; the chat
 * coordinator does that once per new conversation, for the title the
 * service generates after the first reply.
 *
 * The cache is a linked slice rather than the resource value itself: the
 * toolkit exposes the resource's own value signal as `historyValue`, so
 * patching that would write into the resource and abort a read in flight.
 */
export const ThreadSearchStore = signalStore(
  { providedIn: 'root' },

  withState({
    query: '',
    /** Moment of the last load; the date sections are computed against it. */
    loadedAt: 0,
  }),

  withProps(() => ({ _threadClient: inject(ThreadClient) })),

  withResource((store) => ({ history: store._threadClient.listResource() })),

  withLinkedState((store) => ({
    /** The cached list: the last answer of the service plus the local changes since. */
    threads: linkedSignal<ChatThreadSummary[] | undefined, ChatThreadSummary[]>(
      {
        source: store.historyValue,
        computation: (history) => history ?? [],
      },
    ),
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
    /** Reads the history again; the answer replaces the cache. */
    load(): void {
      patchState(store, { loadedAt: Date.now() });
      store._historyReload();
    },

    setQuery(query: string): void {
      patchState(store, { query });
    },
  })),

  withReducer(
    on(sessionEvents.invalidated, () => ({
      query: '',
      loadedAt: 0,
      threads: [],
    })),
    on(threadEvents.started, ({ payload }) => (state) => ({
      threads: [
        { ...payload, updatedAt: payload.createdAt },
        ...without(state.threads, payload.id),
      ],
      loadedAt: Math.max(state.loadedAt, payload.createdAt),
    })),
    on(threadEvents.touched, ({ payload }) => (state) => ({
      threads: state.threads.map((thread) =>
        thread.id === payload.id
          ? { ...thread, updatedAt: payload.updatedAt }
          : thread,
      ),
      loadedAt: Math.max(state.loadedAt, payload.updatedAt),
    })),
    on(threadEvents.renamed, ({ payload }) => (state) => ({
      threads: state.threads.map((thread) =>
        thread.id === payload.id ? payload : thread,
      ),
    })),
    on(threadEvents.removed, ({ payload }) => (state) => ({
      threads: without(state.threads, payload),
    })),
    on(threadEvents.cleared, () => ({ threads: [] })),
  ),
  withEventHandlers((store, events = inject(Events)) => ({
    session: events.on(sessionEvents.established, sessionEvents.refreshed).pipe(
      tap(() => store.load()),
      ignoreElements(),
    ),
  })),

  withDevtools('threadSearch'),
);

function without(
  threads: ChatThreadSummary[],
  id: string,
): ChatThreadSummary[] {
  return threads.filter((thread) => thread.id !== id);
}
