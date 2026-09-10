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
import { on, withReducer } from '@ngrx/signals/events';

import { sessionEvents } from '../../auth/api/events';
import { SESSION, type SessionScope } from '../../auth/api/session';
import { ResearchClient } from '../data/research-client';
import type { ResearchPeople } from '../data/research-contracts';
import { researchInterestEvents } from '../data/research-interest-events';
export const ResearchInterestSearchStore = signalStore(
  withState({ id: '', owner: null as SessionScope | null }),
  withProps(() => ({
    _client: inject(ResearchClient),
    _session: inject(SESSION),
  })),
  withResource((store) => ({
    people: store._client.peopleResource(store.id, store.owner),
  })),
  withLinkedState((store) => ({
    page: linkedSignal<ResearchPeople | undefined, ResearchPeople | null>({
      source: store.peopleValue,
      computation: (value) => value ?? null,
    }),
  })),
  withComputed((store) => ({
    view: computed(() => {
      const owner = store.owner();
      return store.id() && owner && store._session.isCurrent(owner)
        ? store.page()
        : null;
    }),
  })),
  withMethods((store) => ({
    load(id: string) {
      const owner = store._session.scope();
      if (store.id() === id && store.owner() === owner) return;
      patchState(store, { id: owner ? id : '', owner, page: null });
    },
    reload() {
      if (store.id() && !store.peopleIsLoading()) store._peopleReload();
    },
  })),
  withReducer(
    on(sessionEvents.invalidated, () => ({ id: '', owner: null, page: null })),
    on(researchInterestEvents.saved, ({ payload }, state) =>
      state.id === payload.id &&
      state.owner?.uid === payload.scope.uid &&
      state.owner?.generation === payload.scope.generation
        ? { page: payload.page }
        : {},
    ),
  ),
  withDevtools('researchInterestSearch'),
);
