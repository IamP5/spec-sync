import { computed, inject } from '@angular/core';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import {
  signalStore,
  withComputed,
  withMethods,
  withProps,
} from '@ngrx/signals';

import {
  type ChatEffortOption,
  type ChatModelOption,
} from '../../data/chat-model';
import { ChatModelClient } from '../../data/chat-model-client';

/**
 * Search store of the models the assistant can answer with and the
 * reasoning efforts it can apply, as the AI service reports them
 * (`catalogValue` holds the catalog once loaded). Read once when the chat
 * opens; the composer shows the selectors as soon as there is a choice, and
 * the chat coordinator sends the picks with every run.
 */
export const ModelSearchStore = signalStore(
  { providedIn: 'root' },

  withProps(() => ({ _client: inject(ChatModelClient) })),

  withResource((store) => ({ catalog: store._client.catalogResource() })),

  withComputed((store) => ({
    models: computed(
      (): ChatModelOption[] => store.catalogValue()?.models ?? [],
    ),
    /** Id the service answers with when no model is picked; empty until loaded. */
    defaultModelId: computed(() => store.catalogValue()?.defaultModelId ?? ''),
    efforts: computed(
      (): ChatEffortOption[] => store.catalogValue()?.efforts ?? [],
    ),
    /** Effort the service applies when none is picked; empty until loaded. */
    defaultEffortId: computed(
      () => store.catalogValue()?.defaultEffortId ?? '',
    ),
  })),

  withMethods((store) => ({
    retry(): void {
      store._catalogReload();
    },
  })),

  withDevtools('modelSearch'),
);
