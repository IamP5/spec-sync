import { DOCUMENT } from '@angular/common';
import { computed, inject } from '@angular/core';
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
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { on, withReducer } from '@ngrx/signals/events';

import { sessionEvents } from '../../auth/api/events';
import { SESSION } from '../../auth/api/session';
import { ingestionAccessMessage } from '../data/ingestion-access';
import { IngestionClient } from '../data/ingestion-client';
import {
  type IngestionRequest,
  type IngestionReview,
} from '../data/ingestion-contracts';

/**
 * One import run: create it, read its persisted progress and draft, publish
 * the reviewed selection or reject it. Requests carry the signed-in user's
 * ID token and the API authorises by its roles, so the run detail works on
 * the ingestion page and inside a chat card alike.
 */
export const IngestionDetailStore = signalStore(
  withState({ id: '', researchId: '' }),
  withProps(() => ({
    _client: inject(IngestionClient),
    _auth: inject(SESSION),
    _document: inject(DOCUMENT),
  })),
  withComputed((store) => ({
    signedIn: store._auth.authenticated,
    sessionScope: store._auth.scope,
  })),
  withResource((store) => ({
    run: store._client.detailResource(store.id, store.researchId),
  })),
  withMutations((store) => ({
    downloadSource: rxMutation({
      operation: (_: void) =>
        store._client.source(store.id(), store.researchId()),
      onSuccess: (response) => {
        if (!response.body) return;
        const url = URL.createObjectURL(response.body);
        const link = store._document.createElement('a');
        link.href = url;
        link.download =
          response.headers
            .get('Content-Disposition')
            ?.match(/filename="([^"]+)"/)?.[1] ?? 'captured-source';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
    }),
    create: rxMutation({
      operation: (input: { id: string; request: IngestionRequest }) =>
        store._client.create(input.id, input.request),
      onSuccess: (run) => patchState(store, { id: run.id }),
    }),
    publish: rxMutation({
      operation: (review: IngestionReview) =>
        store._client.publish(store.id(), review, store.researchId()),
      onSuccess: () => store._runReload(),
    }),
    reject: rxMutation({
      operation: (_: void) => store._client.reject(store.id()),
      onSuccess: () => store._runReload(),
    }),
  })),
  withComputed((store) => ({
    /** Why the run failed to load: the API's 401/403 explained, else a generic hint. */
    runFailure: computed(() => {
      const error = store.runError();
      return error
        ? (ingestionAccessMessage(error) ??
            $localize`The import could not be loaded. Refresh to try again.`)
        : '';
    }),
    /** Why the captured source failed to download, explained the same way. */
    downloadFailure: computed(() => {
      const error = store.downloadSourceError();
      return error
        ? (ingestionAccessMessage(error) ??
            $localize`Could not download the captured file. Try again.`)
        : '';
    }),
  })),
  withMethods((store) => ({
    /** Points the store at a run; an empty id detaches it. */
    load(id: string, researchId = '') {
      patchState(store, { id, researchId });
    },
    reload() {
      store._runReload();
    },
  })),
  withReducer(
    on(sessionEvents.invalidated, () => ({ id: '', researchId: '' })),
  ),
  withDevtools('ingestionDetail'),
);
