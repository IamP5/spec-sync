import { computed, inject } from '@angular/core';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import { signalStore, withComputed, withProps } from '@ngrx/signals';
import { on, withReducer } from '@ngrx/signals/events';

import { sessionEvents } from '../../../auth/api/events';
import {
  type ChatMode,
  type ChatModeOption,
  DEFAULT_CHAT_MODE,
} from '../../data/chat-model';
import { ChatModelClient } from '../../data/chat-model-client';

/**
 * Search store of the modes the assistant can answer in, as the service
 * reports them (`catalogValue` holds the catalog once loaded, reasoning
 * efforts included for the coordinator's compatibility path). Read once when
 * the chat opens; the composer shows the picker as soon as there is a choice,
 * and the chat coordinator sends the pick with every run.
 */
export const ModelSearchStore = signalStore(
  { providedIn: 'root' },

  withProps(() => ({ _client: inject(ChatModelClient) })),

  withResource((store) => ({ catalog: store._client.catalogResource() })),

  withComputed((store) => ({
    modes: computed((): ChatModeOption[] => store.catalogValue()?.modes ?? []),
    /** Mode the service answers in when none is sent; `normal` until loaded. */
    defaultModeId: computed(
      (): ChatMode => store.catalogValue()?.defaultModeId ?? DEFAULT_CHAT_MODE,
    ),
  })),

  withReducer(
    on(sessionEvents.invalidated, () => ({ catalogValue: undefined })),
  ),
  withDevtools('modelSearch'),
);
