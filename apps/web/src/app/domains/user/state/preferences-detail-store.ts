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
  Events,
  on,
  withEventHandlers,
  withReducer,
} from '@ngrx/signals/events';
import { ignoreElements, tap } from 'rxjs';

import { sessionEvents } from '../../auth/api/events';
import { SESSION } from '../../auth/api/session';
import {
  DEFAULT_PREFERENCES,
  initialsOf,
  Preferences,
} from '../data/preferences';
import { UserPreferencesClient } from '../data/user-preferences-client';

/** Browser-local user preferences, shared through the public preference coordinator. */
export const PreferencesDetailStore = signalStore(
  { providedIn: 'root' },

  withState<Preferences & { error: string }>({
    ...DEFAULT_PREFERENCES,
    error: '',
  }),

  withProps(() => ({
    _preferencesClient: inject(UserPreferencesClient),
    _session: inject(SESSION),
  })),

  withComputed((store) => ({
    initials: computed(() => initialsOf(store.displayName())),
    hasName: computed(() => store.displayName().trim().length > 0),
  })),

  withMethods((store) => ({
    load(): void {
      patchState(
        store,
        store._session.authenticated()
          ? store._preferencesClient.load()
          : { ...DEFAULT_PREFERENCES },
      );
    },

    update(changes: Partial<Preferences>): void {
      if (!store._session.authenticated()) return;
      patchState(store, changes);
      const saved = store._preferencesClient.save({
        theme: store.theme(),
        displayName: store.displayName(),
        showActivity: store.showActivity(),
        mode: store.mode(),
        roleModels: store.roleModels(),
        effort: store.effort(),
      });
      patchState(store, {
        error: saved ? '' : 'Your browser could not save this preference.',
      });
    },
  })),

  withReducer(
    on(sessionEvents.invalidated, () => ({
      ...DEFAULT_PREFERENCES,
      error: '',
    })),
  ),
  withEventHandlers((store, events = inject(Events)) => ({
    session: events.on(sessionEvents.established).pipe(
      tap(() => store.load()),
      ignoreElements(),
    ),
  })),
  withHooks({
    onInit(store) {
      store.load();
    },
  }),

  withDevtools('preferencesDetail'),
);
