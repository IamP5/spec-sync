import { computed, effect, inject, linkedSignal } from '@angular/core';
import {
  rxMutation,
  withDevtools,
  withMutations,
  withResource,
} from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withLinkedState,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { on, withReducer } from '@ngrx/signals/events';
import { map, throwError } from 'rxjs';

import { sessionEvents } from '../../auth/api/events';
import { SESSION, type SessionScope } from '../../auth/api/session';
import { ResearchClient } from '../data/research-client';
import {
  researchIsActive,
  type ResearchSnapshot,
} from '../data/research-contracts';

export const RESEARCH_POLL_MS = 8000;

/** One private request; polling and cancellation are independent of the chat run. */
export const ResearchDetailStore = signalStore(
  withState({
    id: '',
    owner: null as SessionScope | null,
    detached: null as ResearchSnapshot | null,
    cancellationError: '',
    reinterpretationError: '',
    replayId: '',
  }),
  withProps(() => ({
    _client: inject(ResearchClient),
    _session: inject(SESSION),
  })),
  withResource((store) => ({
    research: store._client.detailResource(store.id, store.owner),
  })),
  withLinkedState((store) => ({
    snapshot: linkedSignal<
      ResearchSnapshot | undefined,
      ResearchSnapshot | null
    >({
      source: store.researchValue,
      computation: (value, previous) => value ?? previous?.value ?? null,
    }),
  })),
  withComputed((store) => ({
    authenticated: store._session.authenticated,
    sessionScope: store._session.scope,
    view: computed(() => {
      const owner = store.owner();
      const snapshot = store.detached() ?? store.snapshot();
      return owner &&
        store._session.isCurrent(owner) &&
        snapshot?.id === store.id()
        ? snapshot
        : null;
    }),
  })),
  withComputed((store) => ({
    polling: computed(() => researchIsActive(store.view())),
  })),
  withMutations((store) => ({
    replay: rxMutation({
      operation: ({
        id,
        newRequestId,
        scope,
      }: {
        id: string;
        newRequestId: string;
        scope: SessionScope;
      }) => {
        if (!id || !store._session.isCurrent(scope))
          return throwError(
            () => new Error('Sign in to reinterpret this source.'),
          );
        return store._client
          .replay(id, newRequestId)
          .pipe(map((snapshot) => ({ snapshot, scope, id })));
      },
      onSuccess: ({ snapshot, scope, id }) => {
        if (store._session.isCurrent(scope) && store.id() === id)
          patchState(store, {
            id: snapshot.id,
            snapshot,
            detached: null,
            reinterpretationError: '',
            replayId: '',
          });
      },
      onError: (_error, { id, scope }) => {
        if (store._session.isCurrent(scope) && store.id() === id)
          patchState(store, {
            reinterpretationError:
              'Could not reinterpret the saved source. Try again.',
          });
      },
    }),
    cancel: rxMutation({
      operation: ({ id, scope }: { id: string; scope: SessionScope }) => {
        if (!id || !store._session.isCurrent(scope))
          return throwError(
            () => new Error('Sign in to manage this research request.'),
          );
        return store._client
          .cancel(id)
          .pipe(map((snapshot) => ({ snapshot, scope, id })));
      },
      onSuccess: ({ snapshot, scope, id }) => {
        if (
          store._session.isCurrent(scope) &&
          store.id() === id &&
          snapshot.id === id
        )
          patchState(store, { detached: snapshot, cancellationError: '' });
      },
      onError: (_error, { id, scope }) => {
        if (store._session.isCurrent(scope) && store.id() === id)
          patchState(store, {
            cancellationError: 'Could not stop following. Try again.',
          });
      },
    }),
  })),
  withMethods((store) => ({
    load(id: string): void {
      const owner = store._session.scope();
      if (
        store.id() === id &&
        store.owner()?.uid === owner?.uid &&
        store.owner()?.generation === owner?.generation
      )
        return;
      patchState(store, {
        id: owner ? id : '',
        owner,
        snapshot: null,
        detached: null,
        cancellationError: '',
        reinterpretationError: '',
        replayId: '',
      });
    },
    detach(): void {
      const scope = store.owner();
      if (scope && !store.cancelIsPending() && !store.replayIsPending()) {
        patchState(store, { cancellationError: '' });
        store.cancel({ id: store.id(), scope });
      }
    },
    reinterpret(): void {
      const scope = store.owner();
      const view = store.view();
      if (
        scope &&
        view?.source &&
        view.requestStatus === 'ACTIVE' &&
        (view.status === 'REVIEW' || view.status === 'PUBLISHED') &&
        !store.replayIsPending() &&
        !store.cancelIsPending()
      ) {
        const newRequestId = store.replayId() || crypto.randomUUID();
        patchState(store, {
          reinterpretationError: '',
          replayId: newRequestId,
        });
        store.replay({ id: store.id(), newRequestId, scope });
      }
    },
    reload(): void {
      if (store.owner() && !store.researchIsLoading()) store._researchReload();
    },
  })),
  withReducer(
    on(sessionEvents.invalidated, () => ({
      id: '',
      owner: null,
      snapshot: null,
      detached: null,
      cancellationError: '',
      reinterpretationError: '',
      replayId: '',
    })),
  ),
  withHooks({
    onInit(store) {
      effect((onCleanup) => {
        if (!store.polling()) return;
        const timer = setInterval(() => store.reload(), RESEARCH_POLL_MS);
        onCleanup(() => clearInterval(timer));
      });
    },
  }),
  withDevtools('researchDetail'),
);
