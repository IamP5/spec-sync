import { computed, inject } from '@angular/core';
import { withDevtools } from '@angular-architects/ngrx-toolkit';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';

import {
  DEFAULT_PREFERENCES,
  initialsOf,
  Preferences,
} from '../../data/preferences';
import { PreferencesClient } from '../../data/preferences-client';

/**
 * Detail store of the user preferences edited in the settings dialog and
 * read by the sidebar (name, avatar) and the chat page (activity details,
 * the model and reasoning effort picked in the composer).
 * Persisted through `PreferencesClient`; the theme is owned by the design
 * system's `ZardDarkMode` service and is not mirrored here.
 */
export const PreferencesDetailStore = signalStore(
  { providedIn: 'root' },

  withState<Preferences>({ ...DEFAULT_PREFERENCES }),

  withProps(() => ({
    _preferencesClient: inject(PreferencesClient),
  })),

  withComputed((store) => ({
    initials: computed(() => initialsOf(store.displayName())),
    hasName: computed(() => store.displayName().trim().length > 0),
  })),

  withMethods((store) => ({
    load(): void {
      patchState(store, store._preferencesClient.load());
    },

    update(changes: Partial<Preferences>): void {
      patchState(store, changes);
      store._preferencesClient.save({
        displayName: store.displayName(),
        showActivity: store.showActivity(),
        model: store.model(),
        effort: store.effort(),
      });
    },
  })),

  withHooks({
    onInit(store) {
      store.load();
    },
  }),

  withDevtools('preferencesDetail'),
);
