import { inject } from '@angular/core';
import {
  rxMutation,
  withDevtools,
  withMutations,
} from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { injectDispatch, on, withReducer } from '@ngrx/signals/events';
import { map, takeUntil, throwError } from 'rxjs';

import { sessionEvents } from '../../auth/api/events';
import { SESSION, type SessionScope } from '../../auth/api/session';
import { ResearchClient } from '../data/research-client';
import type { ResearchInterestInput } from '../data/research-contracts';
import { researchInterestEvents } from '../data/research-interest-events';
export const ResearchInterestDetailStore = signalStore(
  withState({ id: '', error: '', saved: false }),
  withProps(() => ({
    _client: inject(ResearchClient),
    _session: inject(SESSION),
    _events: injectDispatch(researchInterestEvents),
  })),
  withMutations((store) => ({
    save: rxMutation({
      operation: ({
        id,
        scope,
        input,
      }: {
        id: string;
        scope: SessionScope;
        input: ResearchInterestInput;
      }) => {
        if (!store._session.isCurrent(scope))
          return throwError(() => new Error('Sign in to share your profile'));
        return store._client.saveInterest(id, input).pipe(
          takeUntil(store._session.invalidated$),
          map((page) => ({ id, scope, page })),
        );
      },
      onSuccess: ({ id, scope, page }) => {
        if (store._session.isCurrent(scope)) {
          store._events.saved({ id, scope, page });
          if (store.id() === id) patchState(store, { saved: true, error: '' });
        }
      },
      onError: (_error, { id, scope }) => {
        if (store.id() === id && store._session.isCurrent(scope))
          patchState(store, {
            error: 'Não foi possível salvar. Tente novamente.',
          });
      },
    }),
  })),
  withMethods((store) => ({
    load(id: string) {
      if (id !== store.id()) patchState(store, { id, error: '', saved: false });
    },
    submit(input: ResearchInterestInput) {
      const scope = store._session.scope();
      if (!scope || !store.id() || store.saveIsPending()) return;
      patchState(store, { error: '', saved: false });
      store.save({ id: store.id(), scope, input });
    },
  })),
  withReducer(
    on(sessionEvents.invalidated, () => ({ id: '', error: '', saved: false })),
  ),
  withDevtools('researchInterestDetail'),
);
