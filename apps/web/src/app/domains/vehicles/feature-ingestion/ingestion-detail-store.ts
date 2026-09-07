import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
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

import { CuratorSessionClient } from '../data/curator-session-client';
import { IngestionClient } from '../data/ingestion-client';
import {
  type IngestionRequest,
  type IngestionReview,
} from '../data/ingestion-contracts';

/**
 * One import run: create it, read its persisted progress and draft, publish
 * the reviewed selection or reject it. The curator key comes from the
 * session client, so the run detail works on the ingestion page and inside
 * a chat card alike.
 */
export const IngestionDetailStore = signalStore(
  withState({ id: '' }),
  withProps(() => ({
    _client: inject(IngestionClient),
    _session: inject(CuratorSessionClient),
    _document: inject(DOCUMENT),
  })),
  withComputed((store) => ({ hasKey: store._session.hasKey })),
  withResource((store) => ({
    run: store._client.detailResource(store.id, store._session.key),
  })),
  withMutations((store) => ({
    downloadSource: rxMutation({
      operation: (_: void) =>
        store._client.source(store.id(), store._session.key()),
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
        store._client.create(input.id, input.request, store._session.key()),
      onSuccess: (run) => patchState(store, { id: run.id }),
    }),
    publish: rxMutation({
      operation: (review: IngestionReview) =>
        store._client.publish(store.id(), review, store._session.key()),
      onSuccess: () => store._runReload(),
    }),
    reject: rxMutation({
      operation: (_: void) =>
        store._client.reject(store.id(), store._session.key()),
      onSuccess: () => store._runReload(),
    }),
  })),
  withMethods((store) => ({
    /** Points the store at a run; an empty id detaches it. */
    load(id: string) {
      patchState(store, { id });
    },
    reload() {
      store._runReload();
    },
    setKey(key: string) {
      store._session.set(key);
    },
  })),
  withDevtools('ingestionDetail'),
);
