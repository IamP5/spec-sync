import { DOCUMENT } from '@angular/common';
import { inject, signal } from '@angular/core';
import {
  rxMutation,
  withDevtools,
  withMutations,
  withResource,
} from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import { IngestionClient } from '../data/ingestion-client';
import {
  type IngestionRequest,
  type IngestionReview,
} from '../data/ingestion-contracts';
export const IngestionDetailStore = signalStore(
  withState({ id: '' }),
  withProps(() => ({
    _client: inject(IngestionClient),
    _key: signal(''),
    _document: inject(DOCUMENT),
  })),
  withResource((store) => ({
    run: store._client.detailResource(store.id, store._key),
  })),
  withMutations((store) => ({
    downloadSource: rxMutation({
      operation: (_: void) => store._client.source(store.id(), store._key()),
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
        store._client.create(input.id, input.request, store._key()),
      onSuccess: (run) => patchState(store, { id: run.id }),
    }),
    publish: rxMutation({
      operation: (review: IngestionReview) =>
        store._client.publish(store.id(), review, store._key()),
      onSuccess: () => store._runReload(),
    }),
    reject: rxMutation({
      operation: (_: void) => store._client.reject(store.id(), store._key()),
      onSuccess: () => store._runReload(),
    }),
  })),
  withMethods((store) => ({
    connect(key: string, id: string) {
      store._key.set(key);
      patchState(store, { id });
    },
    reload() {
      store._runReload();
    },
  })),
  withDevtools('ingestionDetail'),
);
