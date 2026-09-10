import { computed, inject } from '@angular/core';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import {
  signalStore,
  withComputed,
  withMethods,
  withProps,
} from '@ngrx/signals';
import { on, withReducer } from '@ngrx/signals/events';

import { sessionEvents } from '../../auth/api/events';
import { SESSION } from '../../auth/api/session';
import { ResearchClient } from '../data/research-client';

/** Recover the signed-in user's persisted subscriptions after refreshing the page. */
export const ResearchSearchStore = signalStore(
  withProps(() => ({
    _client: inject(ResearchClient),
    _session: inject(SESSION),
  })),
  withResource((store) => ({ research: store._client.listResource() })),
  withComputed((store) => ({
    authenticated: store._session.authenticated,
    requests: computed(() =>
      store._session.scope() ? (store.researchValue() ?? []) : [],
    ),
  })),
  withMethods((store) => ({
    reload(): void {
      store._researchReload();
    },
  })),
  withReducer(
    on(sessionEvents.invalidated, () => ({ researchValue: undefined })),
  ),
  withDevtools('researchSearch'),
);
