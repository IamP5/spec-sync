import { computed, inject } from '@angular/core';
import { withDevtools, withResource } from '@angular-architects/ngrx-toolkit';
import {
  signalStore,
  withComputed,
  withMethods,
  withProps,
} from '@ngrx/signals';
import { on, withReducer } from '@ngrx/signals/events';

import { sessionEvents } from '../../../auth/api/events';
import {
  type ChatEffortOption,
  type ChatMode,
  type ChatModelOption,
  type ChatModeOption,
  type ChatRoleOption,
  DEFAULT_CHAT_MODE,
} from '../../data/chat-model';
import { ChatModelClient } from '../../data/chat-model-client';

/**
 * Search store of the modes the assistant can answer in, the roles and models
 * the advanced selector may override and the reasoning efforts the service
 * can apply, as it reports them (`catalogValue` holds the catalog once
 * loaded). Read once when the chat opens; the composer shows the picker as
 * soon as there is a choice, and the chat coordinator sends the picks with
 * every run.
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
    /** The mode auto settled on for the last run, when it has. */
    /** Roles the advanced selector may override; empty while there are none. */
    roles: computed((): ChatRoleOption[] => store.catalogValue()?.roles ?? []),
    models: computed(
      (): ChatModelOption[] => store.catalogValue()?.models ?? [],
    ),
    efforts: computed(
      (): ChatEffortOption[] => store.catalogValue()?.efforts ?? [],
    ),
    /** Effort the service applies when none is picked; empty until loaded. */
    defaultEffortId: computed(
      () => store.catalogValue()?.defaultEffortId ?? '',
    ),
  })),

  withMethods((store) => ({
    /**
     * Reads the catalog again. The chat coordinator does this after a run in
     * auto mode, since that is where the service reports the mode it settled
     * on for the pill.
     */
    reload(): void {
      store._catalogReload();
    },
  })),

  withReducer(
    on(sessionEvents.invalidated, () => ({ catalogValue: undefined })),
  ),
  withDevtools('modelSearch'),
);
